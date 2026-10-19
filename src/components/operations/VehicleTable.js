"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Search, Loader2, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, AlertTriangle, ListFilter } from "lucide-react";

import { listOperationsBatchVehicles } from "@/lib/operations/api";
import { CatalyticApiError } from "@/lib/catalytic/http";
import { Input } from "@/components/ui/input";
import StatusPill from "@/components/catalytic/StatusPill";
import { OVERALL_STATUS, OVERALL_STATUS_TONE, LEG_STATUS_TONE, VEHICLE_SORT_FIELDS } from "@/lib/operations/constants";
import { formatMoney, completenessMeta, deriveWeightStatus } from "@/lib/operations/format";

const PAGE_SIZE = 25;

const STATUS_FILTERS = [
    { id: "", label: "All" },
    { id: OVERALL_STATUS.PENDING, label: "Pending" },
    { id: OVERALL_STATUS.PROCESSING, label: "Processing" },
    { id: OVERALL_STATUS.PARTIAL, label: "Partial" },
    { id: OVERALL_STATUS.DONE, label: "Done" },
    { id: OVERALL_STATUS.FAILED, label: "Failed" },
];

const COLUMNS = [
    { id: "lot", label: "Lot #", sortable: false },
    { id: "vin", label: "VIN", sortable: false },
    { id: "year", label: "Year", sortable: true },
    { id: "make", label: "Make", sortable: true },
    { id: "model", label: "Model", sortable: true },
    { id: "engine_value", label: "Engine", sortable: false },
    { id: "transmission_value", label: "Transmission", sortable: false },
    { id: "cats_value", label: "Catalytic", sortable: true },
    { id: "scrap_value", label: "Scrap", sortable: true },
    // Two distinct, separately-sortable columns — never one combined
    // "Total / Known" column. complete_recovery_total and
    // partial_known_components_subtotal are different financial
    // categories at the batch level (see FinancialSummaryCards), and the
    // same distinction holds per-vehicle: total_expected_recovery is only
    // set for COMPLETE/COMPLETE_WITH_ESTIMATES vehicles, while
    // known_components_subtotal is the partial figure for everyone else.
    // Both are real backend sort fields (app.operations.finance.FINANCIAL_SORT_FIELDS),
    // so each column sorts by exactly the value it displays — no
    // misleading "sorts by A, displays A-or-B" behavior.
    { id: "total_expected_recovery", label: "Complete Recovery", sortable: true },
    { id: "known_components_subtotal", label: "Known Subtotal", sortable: true },
    { id: "completeness", label: "Estimate", sortable: false },
    { id: "parts_status", label: "Parts", sortable: false },
    { id: "ourdb_status", label: "OurDB", sortable: false },
    { id: "weight", label: "Weight", sortable: false },
    { id: "warnings", label: "Warnings", sortable: false },
];

function useDebounced(value, delayMs) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delayMs);
        return () => clearTimeout(t);
    }, [value, delayMs]);
    return debounced;
}

// Server-paginated/sorted/filtered — never fetches all 400-800 rows to
// sort or search client-side (see spec Section 10). Stable row key is
// the OperationsBatchVehicle id, never the VIN (duplicate VINs are
// legitimate, distinct rows).
export default function VehicleTable({ batchId, onOpenVehicle, refreshKey }) {
    const [page, setPage] = useState(0);
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("");
    const [sortBy, setSortBy] = useState("source_row_number");
    const [sortDir, setSortDir] = useState("asc");

    const [rows, setRows] = useState(null);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const debouncedSearch = useDebounced(search, 350);

    useEffect(() => { setPage(0); }, [debouncedSearch, status, sortBy, sortDir]);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const data = await listOperationsBatchVehicles(batchId, {
                limit: PAGE_SIZE, offset: page * PAGE_SIZE,
                search: debouncedSearch || undefined, status: status || undefined,
                sortBy, sortDir,
            });
            setRows(Array.isArray(data?.items) ? data.items : []);
            setTotal(data?.total ?? 0);
        } catch (e) {
            setError(e instanceof CatalyticApiError ? e.message : "Failed to load vehicles");
            setRows(null);
        } finally {
            setLoading(false);
        }
    }, [batchId, page, debouncedSearch, status, sortBy, sortDir]);

    useEffect(() => { load(); }, [load, refreshKey]);

    const toggleSort = (fieldId) => {
        if (!VEHICLE_SORT_FIELDS.has(fieldId)) return;
        if (sortBy === fieldId) {
            setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        } else {
            setSortBy(fieldId);
            setSortDir("asc");
        }
    };

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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

    const warningsFor = (v) => {
        try {
            const parsed = v.warnings_json ? JSON.parse(v.warnings_json) : null;
            if (!parsed) return [];
            return Array.isArray(parsed) ? parsed : [String(parsed)];
        } catch {
            return [];
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <ListFilter className="h-3.5 w-3.5 text-white/30 mr-1" />
                    {STATUS_FILTERS.map((f) => (
                        <button
                            key={f.id || "all"}
                            type="button"
                            onClick={() => setStatus(f.id)}
                            className={[
                                "px-3 h-8 rounded-xl text-[11px] font-bold uppercase tracking-wider border transition-all",
                                status === f.id ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300" : "border-white/10 text-white/45 hover:text-white hover:bg-white/5",
                            ].join(" ")}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search VIN, lot, make/model, year"
                        className="h-9 pl-9 rounded-xl bg-white/5 border-white/10 text-xs"
                    />
                </div>
            </div>

            {loading ? (
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
                <>
                    <div className="hidden lg:block overflow-x-auto rounded-2xl border border-white/10 bg-black/25">
                        <table className="w-full text-xs">
                            <thead className="bg-black/40">
                                <tr>{COLUMNS.map(headerCell)}</tr>
                            </thead>
                            <tbody>
                                {rows.map((v) => {
                                    const fin = v.financials || {};
                                    const cm = completenessMeta(fin.completeness_status);
                                    const warnings = warningsFor(v);
                                    return (
                                        <tr
                                            key={v.id}
                                            className="odd:bg-white/[0.02] hover:bg-white/[0.06] cursor-pointer transition-colors"
                                            onClick={() => onOpenVehicle?.(v)}
                                        >
                                            <td className="px-3 py-2 border-b border-white/5 text-white/70 whitespace-nowrap">{v.lot_number || "—"}</td>
                                            <td className="px-3 py-2 border-b border-white/5 text-white/35 font-mono whitespace-nowrap">{v.full_vin || "—"}</td>
                                            <td className="px-3 py-2 border-b border-white/5 text-white/70 whitespace-nowrap">{v.year || "—"}</td>
                                            <td className="px-3 py-2 border-b border-white/5 text-white/80 whitespace-nowrap">{v.make || "—"}</td>
                                            <td className="px-3 py-2 border-b border-white/5 text-white/80 whitespace-nowrap">{v.model || "—"}</td>
                                            <td className="px-3 py-2 border-b border-white/5 text-white/70 whitespace-nowrap">{formatMoney(fin.engine_value)}</td>
                                            <td className="px-3 py-2 border-b border-white/5 text-white/70 whitespace-nowrap">{formatMoney(fin.transmission_value)}</td>
                                            <td className="px-3 py-2 border-b border-white/5 text-white/70 whitespace-nowrap">{formatMoney(fin.cats_value)}</td>
                                            <td className="px-3 py-2 border-b border-white/5 text-white/70 whitespace-nowrap">{formatMoney(fin.scrap_value)}</td>
                                            <td className="px-3 py-2 border-b border-white/5 whitespace-nowrap">
                                                <span className={fin.total_expected_recovery != null ? "text-emerald-300 font-bold" : "text-white/30"}>
                                                    {formatMoney(fin.total_expected_recovery)}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 border-b border-white/5 whitespace-nowrap">
                                                <span className={fin.known_components_subtotal != null ? "text-amber-300/90" : "text-white/30"}>
                                                    {formatMoney(fin.known_components_subtotal)}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 border-b border-white/5"><StatusPill label={cm.label} tone={cm.tone} /></td>
                                            <td className="px-3 py-2 border-b border-white/5"><StatusPill label={v.parts_status} tone={LEG_STATUS_TONE[v.parts_status] || "neutral"} /></td>
                                            <td className="px-3 py-2 border-b border-white/5"><StatusPill label={v.ourdb_status} tone={LEG_STATUS_TONE[v.ourdb_status] || "neutral"} /></td>
                                            <td className="px-3 py-2 border-b border-white/5">
                                                {(() => {
                                                    const ws = deriveWeightStatus(v);
                                                    return <StatusPill label={ws.label} tone={ws.tone} />;
                                                })()}
                                            </td>
                                            <td className="px-3 py-2 border-b border-white/5 text-amber-300/80 max-w-[160px] truncate">
                                                {warnings.length ? warnings.join("; ") : "—"}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="lg:hidden space-y-2">
                        {rows.map((v) => {
                            const fin = v.financials || {};
                            const cm = completenessMeta(fin.completeness_status);
                            return (
                                <button
                                    type="button"
                                    key={v.id}
                                    onClick={() => onOpenVehicle?.(v)}
                                    className="w-full text-left rounded-xl border border-white/10 bg-black/25 p-3 space-y-1.5"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="text-sm font-bold text-white/90 truncate">
                                            {[v.year, v.make, v.model].filter(Boolean).join(" ") || "Unknown vehicle"}
                                        </div>
                                        <StatusPill label={cm.label} tone={cm.tone} />
                                    </div>
                                    <div className="text-[11px] text-white/40 font-mono truncate">{v.full_vin || "—"}</div>
                                    <div className="text-[11px] text-white/35">Lot {v.lot_number || "—"}</div>
                                    {fin.total_expected_recovery != null ? (
                                        <div className="text-sm font-bold text-emerald-300">
                                            {formatMoney(fin.total_expected_recovery)} <span className="text-[10px] font-normal text-white/30">complete recovery</span>
                                        </div>
                                    ) : (
                                        <div className="text-sm font-bold text-amber-300/90">
                                            {formatMoney(fin.known_components_subtotal)} <span className="text-[10px] font-normal text-white/30">known subtotal (partial)</span>
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex items-center justify-between gap-3 text-xs text-white/40">
                        <span>{total} vehicle{total === 1 ? "" : "s"} · page {page + 1} of {totalPages}</span>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                disabled={page === 0}
                                onClick={() => setPage((p) => Math.max(0, p - 1))}
                                className="p-1.5 rounded-lg border border-white/10 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <button
                                type="button"
                                disabled={page + 1 >= totalPages}
                                onClick={() => setPage((p) => p + 1)}
                                className="p-1.5 rounded-lg border border-white/10 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
