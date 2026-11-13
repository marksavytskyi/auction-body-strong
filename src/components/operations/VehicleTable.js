"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Search, Loader2, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, AlertTriangle, ListFilter } from "lucide-react";

import { listOperationsBatchVehicles } from "@/lib/operations/api";
import { CatalyticApiError } from "@/lib/catalytic/http";
import { Input } from "@/components/ui/input";
import PageSizeSelect from "@/components/ui/PageSizeSelect";
import LoadMoreRows from "@/components/ui/LoadMoreRows";
import usePageSize from "@/hooks/usePageSize";
import usePagedRows from "@/hooks/usePagedRows";
import { isAll, showingLabel } from "@/lib/pagination";
import StatusPill from "@/components/catalytic/StatusPill";
import { CATALYTIC_LABEL, CATALYTIC_LABEL_TONE, CATS_SOURCE_LABEL, OVERALL_STATUS, OVERALL_STATUS_LABEL, OVERALL_STATUS_TONE, LEG_STATUS_TONE, VEHICLE_SORT_FIELDS, PARTS_CONFIDENCE_LABEL } from "@/lib/operations/constants";
import { formatMoney, completenessMeta, componentLabel, deriveWeightStatus } from "@/lib/operations/format";
import CellStatus, { LatestAttempt, legState } from "./CellStatus";
import CatalyticSourceCell from "./CatalyticSourceCell";
import ColumnsMenu from "@/components/ui/ColumnsMenu";
import useColumnVisibility from "@/hooks/useColumnVisibility";

const DEFAULT_PAGE_SIZE = 25;

const CATALYTIC_COLUMNS = [
    { id: "src_our_database", source: "OUR_DATABASE", label: "Our Database" },
    { id: "src_catdb_vin", source: "CATDB_VIN", label: "CatDB VIN" },
    { id: "src_catdb_local", source: "CATDB_LOCAL", label: "CatDB Local" },
    { id: "src_ecotrade_local", source: "ECOTRADE_LOCAL", label: "EcoTrade Local" },
];

const STATUS_FILTERS = [
    { id: "", label: "All" },
    ...Object.values(OVERALL_STATUS).map((id) => ({ id, label: OVERALL_STATUS_LABEL[id] })),
];

const td = "px-3 py-2 border-b border-white/5";

// Phase K.49 — every column, in table order; the Columns menu shows or hides each.
// The four catalytic sources each have their own column and read only that source's
// saved result. "Catalytic (selected)" is the ONE price the vehicle's estimate uses (K.60).
const COLUMNS = [
    { id: "lot", label: "Lot #", required: true, cell: (v) => <td key="lot" className={`${td} text-white/70 whitespace-nowrap`}>{v.lot_number || "—"}</td> },
    { id: "vin", label: "VIN", cell: (v) => <td key="vin" className={`${td} text-white/35 font-mono whitespace-nowrap`}>{v.full_vin || "—"}</td> },
    { id: "year", label: "Year", cell: (v) => <td key="year" className={`${td} text-white/70 whitespace-nowrap`}>{v.year || "—"}</td> },
    { id: "make", label: "Make", cell: (v) => <td key="make" className={`${td} text-white/80 whitespace-nowrap`}>{v.make || "—"}</td> },
    { id: "model", label: "Model", cell: (v) => <td key="model" className={`${td} text-white/80 whitespace-nowrap`}>{v.model || "—"}</td> },
    { id: "engine_value", label: "Engine", cell: (v, fin) => <td key="engine_value" className={`${td} text-white/70 whitespace-nowrap`}><ComponentPrice fin={fin} name="engine" value={fin.engine_value} status={v.parts_status} doneWithoutValue="NO_MATCH" /><WeakPriceTag level={v.engine_price_confidence} /></td> },
    { id: "transmission_value", label: "Transmission", cell: (v, fin) => <td key="transmission_value" className={`${td} text-white/70 whitespace-nowrap`}><ComponentPrice fin={fin} name="transmission" value={fin.transmission_value} status={v.parts_status} doneWithoutValue="NO_MATCH" /><WeakPriceTag level={v.transmission_price_confidence} /></td> },
    ...CATALYTIC_COLUMNS.map(({ id, source, label }) => ({
        id, label, source,
        cell: (v) => <td key={id} className={`${td} text-white/70 whitespace-nowrap`}><CatalyticSourceCell source={source} vehicle={v} /></td>,
    })),
    { id: "cats_value", label: "Catalytic (selected)", cell: (v, fin) => <td key="cats_value" className={`${td} text-white/70 whitespace-nowrap`}><ComponentPrice fin={fin} name="catalytic" value={fin.cats_value} /></td> },
    { id: "scrap_value", label: "Scrap", cell: (v, fin) => <td key="scrap_value" className={`${td} text-white/70 whitespace-nowrap`}><ComponentPrice fin={fin} name="scrap" value={fin.scrap_value} status={v.scrap_status} /></td> },
    // K.60 — one estimate per vehicle: Scrap + Engine + Transmission + one catalytic price.
    // Sorted by the same figure it shows (known_components_subtotal is the estimate).
    { id: "known_components_subtotal", label: "Estimate", required: true, cell: (v, fin) => (
        <td key="known_components_subtotal" className={`${td} whitespace-nowrap`}><VehicleEstimate fin={fin} /></td>
    ) },
    { id: "overall_status", label: "Status", cell: (v) => <td key="overall_status" className={td}><StatusPill label={OVERALL_STATUS_LABEL[v.overall_status] || v.overall_status} tone={OVERALL_STATUS_TONE[v.overall_status] || "neutral"} /></td> },
    { id: "parts_status", label: "Parts", cell: (v) => <td key="parts_status" className={td}><StatusPill label={v.parts_status} tone={LEG_STATUS_TONE[v.parts_status] || "neutral"} /></td> },
    { id: "ourdb_status", label: "OurDB status", defaultVisible: false, cell: (v) => <td key="ourdb_status" className={td}><StatusPill label={v.ourdb_status} tone={LEG_STATUS_TONE[v.ourdb_status] || "neutral"} /></td> },
    { id: "weight", label: "Weight", cell: (v) => {
        const ws = deriveWeightStatus(v);
        return <td key="weight" className={td}><StatusPill label={ws.label} tone={ws.tone} /></td>;
    } },
    { id: "warnings", label: "Warnings", cell: (v) => {
        const warnings = warningsFor(v);
        return <td key="warnings" className={`${td} text-amber-300/80 max-w-[160px] truncate`}>{warnings.length ? warnings.join("; ") : "—"}</td>;
    } },
];

const COLUMN_BY_ID = Object.fromEntries(COLUMNS.map((c) => [c.id, c]));

function warningsFor(v) {
    try {
        const parsed = v.warnings_json ? JSON.parse(v.warnings_json) : null;
        if (!parsed) return [];
        return Array.isArray(parsed) ? parsed : [String(parsed)];
    } catch {
        return [];
    }
}

// Only weak prices get a mark, so the table stays clean and they stand out.
function WeakPriceTag({ level }) {
    if (level !== "LOW" && level !== "INSUFFICIENT_DATA") return null;
    return (
        <div
            className={`text-[10px] font-bold ${level === "LOW" ? "text-amber-300/80" : "text-rose-300/80"}`}
            title="Price confidence: open the vehicle for details"
        >
            {level === "LOW" ? "Low confidence" : PARTS_CONFIDENCE_LABEL[level]}
        </div>
    );
}

// A component's price, marked when the recovery rules exclude it or a manual price replaces it.
// Phase K.53: without a price, the cell says what its leg is really doing; with one, the latest
// attempt shows underneath while it runs or after it failed, and the stored price stays.
function ComponentPrice({ fin, name, value, status, doneWithoutValue = "NO_DATA" }) {
    const recovery = fin.recovery;
    const excluded = recovery?.excluded_components?.includes(name);
    if (value == null && status) return <CellStatus state={legState(status, { doneWithoutValue })} />;
    const latest = status && ["QUEUED", "PROCESSING", "FAILED"].includes(status) ? legState(status) : null;
    return (
        <>
            <span className={excluded ? "text-white/30 line-through" : undefined}>{formatMoney(value)}</span>
            <LatestAttempt state={latest} />
            {recovery?.manual_components?.includes(name) && <div className="text-[10px] font-bold text-sky-300/80">Manual</div>}
            {excluded && <div className="text-[10px] text-white/35">Excluded</div>}
            {name === "catalytic" && recovery && !excluded && fin.cats_source && fin.cats_source !== "MANUAL" && (
                <div className="text-[10px] text-white/45">
                    {CATS_SOURCE_LABEL[fin.cats_source] || fin.cats_source}
                    {recovery.catalytic_label && (
                        <span className={`ml-1 font-bold ${CATALYTIC_LABEL_TONE[recovery.catalytic_label] || ""}`}>{CATALYTIC_LABEL[recovery.catalytic_label]}</span>
                    )}
                </div>
            )}
            {name === "catalytic" && recovery?.partial_price && !excluded && (
                <div className="text-[10px] font-bold text-amber-300" title="Only some converters have a CatDB price">Partial price, check</div>
            )}
        </>
    );
}

// K.60 — the vehicle's one estimate. A partial estimate always says so and what's missing.
export function VehicleEstimate({ fin }) {
    const cm = completenessMeta(fin.completeness_status);
    const missing = fin.missing_components || [];
    const partial = fin.completeness_status !== "COMPLETE" && fin.completeness_status !== "COMPLETE_WITH_ESTIMATES";
    return (
        <div>
            <span className={fin.known_components_subtotal == null ? "text-white/30" : partial ? "font-bold text-amber-300/90" : "font-bold text-emerald-300"}>
                {formatMoney(fin.known_components_subtotal)}
            </span>
            <div className="mt-0.5"><StatusPill label={cm.label} tone={cm.tone} /></div>
            {missing.length > 0 && <div className="text-[10px] text-white/40">Missing: {missing.map(componentLabel).join(", ")}</div>}
            {fin.recovery?.partial_price && <div className="text-[10px] text-amber-300/80">Catalytic price is partial</div>}
        </div>
    );
}

function useDebounced(value, delayMs) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delayMs);
        return () => clearTimeout(t);
    }, [value, delayMs]);
    return debounced;
}

// Server-paginated/sorted/filtered — never fetches all 400-800 rows to
// sort or search client-side (see spec Section 10). All loads the same
// server-filtered, server-sorted rows in chunks as you scroll. Stable row key is
// the OperationsBatchVehicle id, never the VIN (duplicate VINs are
// legitimate, distinct rows).
export default function VehicleTable({ batchId, onOpenVehicle, refreshKey, selectedIds, onSelectedIdsChange }) {
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = usePageSize("operations:vehicles:page-size", DEFAULT_PAGE_SIZE);
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("");
    const [sortBy, setSortBy] = useState("source_row_number");
    const [sortDir, setSortDir] = useState("asc");

    const debouncedSearch = useDebounced(search, 350);

    useEffect(() => { setPage(0); }, [debouncedSearch, status, sortBy, sortDir]);
    const changePageSize = (next) => {
        setPage(0);
        setPageSize(next);
    };

    const fetchPage = useCallback((limit, offset) => listOperationsBatchVehicles(batchId, {
        limit, offset,
        search: debouncedSearch || undefined, status: status || undefined,
        sortBy, sortDir,
    }), [batchId, debouncedSearch, status, sortBy, sortDir]);

    const { rows, total, loading, loadingMore, loadMoreFailed, error: loadError, hasMore, loadMore, reload } = usePagedRows({ fetchPage, pageSize, page, refreshKey });
    const error = loadError ? (loadError instanceof CatalyticApiError ? loadError.message : "Failed to load vehicles") : "";
    const load = () => reload({ keep: true });

    const toggleSort = (fieldId) => {
        if (!VEHICLE_SORT_FIELDS.has(fieldId)) return;
        if (sortBy === fieldId) {
            setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        } else {
            setSortBy(fieldId);
            setSortDir("asc");
        }
    };

    const columns = useColumnVisibility("operations:vehicles:columns", COLUMNS);
    const all = isAll(pageSize);
    const totalPages = all ? 1 : Math.max(1, Math.ceil(total / pageSize));
    const selectable = Boolean(onSelectedIdsChange);
    const isSelected = (id) => selectable && selectedIds.includes(id);
    const toggleSelected = (id) => onSelectedIdsChange(
        isSelected(id) ? selectedIds.filter((other) => other !== id) : [...selectedIds, id]
    );
    const selectCheckbox = (v) => (
        <input
            type="checkbox"
            aria-label={`Select vehicle lot ${v.lot_number || v.id}`}
            checked={isSelected(v.id)}
            onChange={() => toggleSelected(v.id)}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4"
        />
    );

    const headerCell = (col) => {
        const sortField = VEHICLE_SORT_FIELDS.has(col.id) ? col.id : null;
        const active = sortField && sortBy === sortField;
        return (
            <th
                key={col.id}
                onClick={sortField ? () => toggleSort(sortField) : undefined}
                className={[
                    "px-3 py-2.5 text-left uppercase tracking-wider text-white/50 font-bold border-b border-white/10 whitespace-nowrap",
                    sortField ? "cursor-pointer hover:text-white select-none" : "",
                ].join(" ")}
            >
                <span className="inline-flex items-center gap-1">
                    {col.label}
                    {active && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                </span>
            </th>
        );
    };


    return (
        <div className="space-y-3">
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <ListFilter className="h-3.5 w-3.5 text-white/30 mr-1" />
                    {STATUS_FILTERS.map((f) => (
                        <button
                            key={f.id || "all"}
                            type="button"
                            onClick={() => setStatus(f.id)}
                            className={[
                                "px-3 h-8 rounded-xl text-[11px] font-bold uppercase tracking-wider border transition-colors",
                                status === f.id ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300" : "border-white/10 text-white/45 hover:text-white hover:bg-white/5",
                            ].join(" ")}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
                <div className="flex w-full items-center gap-2 sm:w-auto">
                    <div className="relative min-w-0 flex-1 sm:w-72 sm:flex-none">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search VIN, lot, make/model, year"
                            className="h-10 pl-9 rounded-xl bg-white/5 border-white/10 text-base sm:h-9 sm:text-xs"
                        />
                    </div>
                    <ColumnsMenu
                        columns={COLUMNS}
                        isVisible={columns.isVisible}
                        onToggle={columns.toggle}
                        onShowAll={columns.showAll}
                        onHideAll={columns.hideAll}
                        onReset={columns.reset}
                    />
                </div>
            </div>

            {loading && !rows ? (
                <div className="flex items-center gap-2 text-white/50 text-sm py-12 justify-center">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading vehicles…
                </div>
            ) : error ? (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2"><AlertTriangle className="h-4 w-4 shrink-0" /> {error}</span>
                    <button type="button" onClick={load} className="underline shrink-0">Retry</button>
                </div>
            ) : !rows || rows.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/25 p-10 text-center text-sm text-white/45">
                    {total === 0 && !search && !status ? "This batch has no vehicles." : "No vehicles match the current filter/search."}
                </div>
            ) : (
                <div className={loading ? "space-y-3 opacity-60" : "space-y-3"} aria-busy={loading}>
                    <div className="hidden lg:block overflow-x-auto rounded-2xl border border-white/10 bg-black/25">
                        <table className="w-full text-xs">
                            <thead className="bg-black/40">
                                <tr>
                                    {selectable && <th className="px-3 py-2.5 border-b border-white/10"><span className="sr-only">Select</span></th>}
                                    {columns.visible.map(headerCell)}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((v) => {
                                    const fin = v.financials || {};
                                    return (
                                        <tr
                                            key={v.id}
                                            className="odd:bg-white/[0.02] hover:bg-white/[0.06] cursor-pointer transition-colors"
                                            onClick={() => onOpenVehicle?.(v)}
                                        >
                                            {selectable && <td className="px-3 py-2 border-b border-white/5">{selectCheckbox(v)}</td>}
                                            {columns.visible.map((col) => col.cell(v, fin))}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="lg:hidden space-y-2">
                        {rows.map((v) => {
                            const fin = v.financials || {};
                            return (
                                <div key={v.id} className="flex items-start gap-2">
                                    {selectable && <div className="flex h-11 w-7 shrink-0 items-center justify-center">{selectCheckbox(v)}</div>}
                                    <div className="min-w-0 flex-1">
                                <button
                                    type="button"
                                    onClick={() => onOpenVehicle?.(v)}
                                    className="w-full text-left rounded-xl border border-white/10 bg-black/25 p-3 space-y-1.5"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="text-sm font-bold text-white/90 truncate">
                                            {[v.year, v.make, v.model].filter(Boolean).join(" ") || "Unknown vehicle"}
                                        </div>
                                        <StatusPill label={OVERALL_STATUS_LABEL[v.overall_status] || v.overall_status} tone={OVERALL_STATUS_TONE[v.overall_status] || "neutral"} />
                                    </div>
                                    <div className="text-[11px] text-white/40 font-mono truncate">
                                        {v.full_vin || "—"} · Lot {v.lot_number || "—"}
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 text-xs text-white/80">
                                        {columns.isVisible(COLUMN_BY_ID.engine_value) && (
                                            <div>
                                                <div className="text-[10px] text-white/35">Engine</div>
                                                <ComponentPrice fin={fin} name="engine" value={fin.engine_value} status={v.parts_status} doneWithoutValue="NO_MATCH" />
                                                <WeakPriceTag level={v.engine_price_confidence} />
                                            </div>
                                        )}
                                        {columns.isVisible(COLUMN_BY_ID.transmission_value) && (
                                            <div>
                                                <div className="text-[10px] text-white/35">Transmission</div>
                                                <ComponentPrice fin={fin} name="transmission" value={fin.transmission_value} status={v.parts_status} doneWithoutValue="NO_MATCH" />
                                                <WeakPriceTag level={v.transmission_price_confidence} />
                                            </div>
                                        )}
                                        {CATALYTIC_COLUMNS.filter((c) => columns.isVisible(COLUMN_BY_ID[c.id])).map((c) => (
                                            <div key={c.id}>
                                                <div className="text-[10px] text-white/35">{c.label}</div>
                                                <CatalyticSourceCell source={c.source} vehicle={v} />
                                            </div>
                                        ))}
                                        {columns.isVisible(COLUMN_BY_ID.cats_value) && (
                                            <div>
                                                <div className="text-[10px] text-white/35">Catalytic (selected)</div>
                                                <ComponentPrice fin={fin} name="catalytic" value={fin.cats_value} />
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-sm">
                                        <span className="text-[10px] font-normal text-white/30">Estimate </span>
                                        <VehicleEstimate fin={fin} />
                                    </div>
                                    {columns.isVisible(COLUMN_BY_ID.scrap_value) && (
                                        <div className="text-xs text-white/70"><span className="text-[10px] text-white/35">Scrap </span><ComponentPrice fin={fin} name="scrap" value={fin.scrap_value} status={v.scrap_status} /></div>
                                    )}
                                </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <LoadMoreRows hasMore={hasMore} loading={loadingMore} failed={loadMoreFailed} onLoadMore={loadMore} loadedCount={rows.length} />

                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-white/40">
                        <span>
                            {showingLabel({ pageSize, page, shown: rows.length, total, noun: "vehicle" })}
                            {!all && totalPages > 1 && <> · page {page + 1} of {totalPages}</>}
                            {selectable && selectedIds.length > 0 && (
                                <> · {selectedIds.length} selected <button type="button" className="underline" onClick={() => onSelectedIdsChange([])}>Clear</button></>
                            )}
                        </span>
                        <div className="flex items-center gap-2">
                            <PageSizeSelect value={pageSize} onChange={changePageSize} />
                            {!all && (<>
                            <button
                                type="button"
                                disabled={page === 0}
                                onClick={() => setPage((p) => Math.max(0, p - 1))}
                                aria-label="Previous page"
                                className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed sm:h-8 sm:w-8"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <button
                                type="button"
                                disabled={page + 1 >= totalPages}
                                onClick={() => setPage((p) => p + 1)}
                                aria-label="Next page"
                                className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed sm:h-8 sm:w-8"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </button>
                            </>)}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
