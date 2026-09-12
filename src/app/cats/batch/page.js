"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import toast from "react-hot-toast";
import { UploadCloud, Loader2, FileText, RefreshCw, FileStack, Eye, X, ArrowUpDown, ArrowUp, ArrowDown, Search } from "lucide-react";

import { createBatch, getBatch, getBatchRows, CatalyticApiError } from "@/lib/catalytic/api";
import { normalizeLookupResult } from "@/lib/catalytic/normalize";
import { normalizeCatdbSnapshot } from "@/lib/catalytic/catdb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAdminTierGate } from "@/hooks/useRoleGate";

const MAX_MB = 25;
const MAX_BYTES = MAX_MB * 1024 * 1024;
// Real BatchJobResponse.status values, verified live: PENDING, RUNNING,
// COMPLETED, FAILED (uppercase). Compared case-insensitively below.
const LIVE_STATUSES = new Set(["pending", "queued", "processing", "running"]);

function fmtMoney(n, currency = "USD") {
    if (n === null || n === undefined || !Number.isFinite(Number(n))) return null;
    try {
        return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
    } catch {
        return `$${Math.round(n)}`;
    }
}

// Derives the valuation-table view of one raw batch row: vehicle label,
// CatDB snapshot (always NO_DATA today — no backend contract, see
// lib/catalytic/catdb.js), Our DB total, and their difference (null until
// CatDB actually has a number).
function toValuationRow(raw) {
    const ourResult = raw.result ? normalizeLookupResult(raw.result) : null;
    const catdb = normalizeCatdbSnapshot(raw.result || {});
    const ourExpected = ourResult?.totalPricing?.expected ?? null;
    const difference = catdb.totalPrice !== null && ourExpected !== null ? ourExpected - catdb.totalPrice : null;

    return {
        raw,
        id: raw.id,
        rowIndex: raw.row_index,
        vin: raw.vin || null,
        vehicleLabel: [raw.year, raw.make, raw.model].filter(Boolean).join(" ") || raw.vin || `Row ${raw.row_index + 1}`,
        make: raw.make || "",
        model: raw.model || "",
        status: String(raw.status || "").toUpperCase(),
        error: raw.error || "",
        catdb,
        ourExpected,
        ourCurrency: ourResult?.totalPricing?.currency || "USD",
        difference,
    };
}

const SORT_OPTIONS = [
    { id: "row", label: "Row order" },
    { id: "our_db", label: "Our DB total" },
    { id: "status", label: "Status" },
    { id: "make", label: "Make / Model" },
];

function RowDetailModal({ row, onClose }) {
    if (!row) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
            <div className="max-w-2xl w-full max-h-[80vh] overflow-auto rounded-2xl border border-white/10 bg-[#0b0d12] p-5" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-bold text-white/90">Row {row.rowIndex + 1} — {row.vehicleLabel}</div>
                    <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 text-white/50"><X className="h-4 w-4" /></button>
                </div>
                {row.error && <div className="mb-3 p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">{row.error}</div>}
                <pre className="text-[11px] text-white/60 whitespace-pre-wrap break-all">{JSON.stringify(row.raw.result ?? row.raw, null, 2)}</pre>
            </div>
        </div>
    );
}

export default function CatsBatchPage() {
    const { ready } = useAdminTierGate();
    const [file, setFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [batchId, setBatchId] = useState(null);
    const [batchMeta, setBatchMeta] = useState(null);
    const [rows, setRows] = useState([]);
    const [rowsError, setRowsError] = useState("");
    const [openRow, setOpenRow] = useState(null);
    const [search, setSearch] = useState("");
    const [sortBy, setSortBy] = useState("row");
    const [sortDir, setSortDir] = useState("asc");
    const pollRef = useRef(null);

    const onDrop = useCallback((accepted, rejections) => {
        if (rejections?.length) {
            toast.error(rejections[0]?.errors?.[0]?.message || "File rejected");
            return;
        }
        const next = accepted?.[0];
        if (!next) return;
        if (!next.name.toLowerCase().endsWith(".csv")) {
            toast.error("Only .csv files are allowed");
            return;
        }
        if (next.size > MAX_BYTES) {
            toast.error(`File is too large. Max ${MAX_MB}MB`);
            return;
        }
        setFile(next);
    }, []);

    const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
        onDrop,
        accept: { "text/csv": [".csv"] },
        maxFiles: 1,
        multiple: false,
        noClick: true,
        noKeyboard: true,
    });

    const status = String(batchMeta?.status || "").toLowerCase();
    const isProcessing = LIVE_STATUSES.has(status);

    const fetchRows = useCallback(async (id) => {
        try {
            const data = await getBatchRows(id, { limit: 2000 });
            setRows(Array.isArray(data) ? data : []);
            setRowsError("");
        } catch (e) {
            setRowsError(e instanceof CatalyticApiError ? e.message : "Failed to load batch rows");
        }
    }, []);

    const fetchStatus = useCallback(
        async (id) => {
            const data = await getBatch(id);
            setBatchMeta(data);
            const s = String(data?.status || "").toLowerCase();
            await fetchRows(id);
            if (!LIVE_STATUSES.has(s) && pollRef.current) {
                clearInterval(pollRef.current);
                pollRef.current = null;
            }
            return data;
        },
        [fetchRows]
    );

    const startPolling = useCallback(
        (id) => {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = setInterval(() => {
                fetchStatus(id).catch(() => {});
            }, 2500);
        },
        [fetchStatus]
    );

    useEffect(() => () => pollRef.current && clearInterval(pollRef.current), []);

    const upload = useCallback(async () => {
        if (!file) return;
        setIsUploading(true);
        const t = toast.loading("Uploading batch…");
        try {
            const res = await createBatch(file);
            if (!res?.id) throw new Error("No batch id returned from server");
            setBatchId(res.id);
            setBatchMeta(res);
            setRows([]);
            toast.success("Batch submitted", { id: t });

            await fetchRows(res.id);
            const s = String(res.status || "").toLowerCase();
            if (LIVE_STATUSES.has(s)) startPolling(res.id);
        } catch (e) {
            toast.error(e instanceof CatalyticApiError ? e.message : "Batch upload failed", { id: t });
        } finally {
            setIsUploading(false);
        }
    }, [file, startPolling, fetchRows]);

    const valuationRows = useMemo(() => rows.map(toValuationRow), [rows]);

    const filteredRows = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return valuationRows;
        return valuationRows.filter(
            (r) => r.vehicleLabel.toLowerCase().includes(q) || (r.vin || "").toLowerCase().includes(q) || r.status.toLowerCase().includes(q)
        );
    }, [valuationRows, search]);

    const sortedRows = useMemo(() => {
        const mult = sortDir === "asc" ? 1 : -1;
        const copy = [...filteredRows];
        copy.sort((a, b) => {
            if (sortBy === "our_db") return ((a.ourExpected ?? -Infinity) - (b.ourExpected ?? -Infinity)) * mult;
            if (sortBy === "status") return a.status.localeCompare(b.status) * mult;
            if (sortBy === "make") return `${a.make} ${a.model}`.localeCompare(`${b.make} ${b.model}`) * mult;
            return (a.rowIndex - b.rowIndex) * mult;
        });
        return copy;
    }, [filteredRows, sortBy, sortDir]);

    const toggleSort = (id) => {
        if (sortBy === id) {
            setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        } else {
            setSortBy(id);
            setSortDir("asc");
        }
    };

    if (!ready) return null;

    return (
        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
            <div
                {...getRootProps()}
                className={[
                    "rounded-3xl border border-dashed p-5 transition-all cursor-pointer glass-card shadow-xl shadow-black/20 h-fit",
                    isDragActive ? "border-sky-400/70 bg-sky-500/[0.08]" : "border-white/15",
                ].join(" ")}
            >
                <input {...getInputProps()} />
                <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-white/40 font-bold mb-4">
                    <FileStack className="h-3.5 w-3.5 text-sky-400" />
                    Copart CSV Import
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <Button type="button" variant="outline" className="h-10 rounded-2xl justify-center" onClick={(e) => { e.stopPropagation(); open(); }}>
                        <FileText className="h-4 w-4 mr-1.5" /> Browse
                    </Button>
                    <Button type="button" className="h-10 rounded-2xl justify-center" onClick={(e) => { e.stopPropagation(); upload(); }} disabled={!file || isUploading}>
                        {isUploading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <UploadCloud className="h-4 w-4 mr-1.5" />}
                        Submit
                    </Button>
                </div>

                <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 px-3 py-3">
                    <div className="text-sm font-semibold text-white truncate">{file ? file.name : "No file selected"}</div>
                    <div className="text-xs text-white/50 mt-1">Max {MAX_MB}MB. Columns: year, make, model, engine, vin (optional).</div>
                </div>

                <div className="mt-3 rounded-xl border border-sky-500/15 bg-sky-500/[0.04] px-3 py-2.5">
                    <p className="text-[11px] text-sky-200/70">
                        CatDB pricing isn&apos;t connected yet — every row shows Our Database value only until the CatDB capture service ships.
                    </p>
                </div>

                {batchMeta && (
                    <div className="mt-4 space-y-2 rounded-2xl border border-white/10 bg-black/30 p-3">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-white/50">Status</span>
                            <span className={`font-bold uppercase ${isProcessing ? "text-sky-300 animate-pulse" : status === "failed" ? "text-rose-300" : "text-emerald-300"}`}>
                                {status || "unknown"}
                            </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-white/50">Rows</span>
                            <span className="text-white/80">{batchMeta.processed_rows ?? "?"} / {batchMeta.total_rows ?? "?"}</span>
                        </div>
                        {batchMeta.unique_configs !== undefined && (
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-white/50">Unique configs</span>
                                <span className="text-white/80">{batchMeta.unique_configs}</span>
                            </div>
                        )}
                        <div className="pt-1">
                            <Button size="sm" variant="outline" className="rounded-xl border-white/15 w-full" onClick={() => fetchStatus(batchId)}>
                                <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-white/[0.06] flex flex-wrap items-center gap-3 justify-between">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-white/70">Valuation Table</h2>
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
                            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter…" className="pl-8 h-9 w-40 rounded-xl bg-white/5 border-white/10 text-xs" />
                        </div>
                        {isProcessing && <Loader2 className="h-4 w-4 animate-spin text-sky-400" />}
                    </div>
                </div>

                <div className="p-4">
                    {rowsError && <div className="mb-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium">{rowsError}</div>}

                    {!batchId ? (
                        <div className="rounded-2xl border border-white/10 bg-black/25 p-8 text-center text-sm text-white/45">
                            Upload a Copart CSV to run batch vehicle valuations.
                        </div>
                    ) : !sortedRows.length ? (
                        <div className="rounded-2xl border border-white/10 bg-black/25 p-8 text-center text-sm text-white/45">
                            {isProcessing ? "Processing… results will appear here." : "No result rows returned yet."}
                        </div>
                    ) : (
                        <div className="overflow-auto rounded-2xl border border-white/10 bg-black/25 max-h-[65vh]">
                            <table className="w-full text-xs">
                                <thead className="bg-black/50 sticky top-0">
                                    <tr>
                                        {[
                                            { id: "make", label: "Vehicle" },
                                            { id: null, label: "VIN" },
                                            { id: null, label: "CatDB" },
                                            { id: "our_db", label: "Our DB" },
                                            { id: null, label: "Difference" },
                                            { id: "status", label: "Status" },
                                            { id: null, label: "" },
                                        ].map((h, idx) => (
                                            <th key={idx} className="px-3 py-2 text-left uppercase tracking-wider text-white/50 font-bold border-b border-white/10 whitespace-nowrap">
                                                {h.id ? (
                                                    <button type="button" onClick={() => toggleSort(h.id)} className="inline-flex items-center gap-1 hover:text-white transition-colors">
                                                        {h.label}
                                                        {sortBy === h.id ? (sortDir === "asc" ? <ArrowUp className="h-3 w-3 text-emerald-400" /> : <ArrowDown className="h-3 w-3 text-emerald-400" />) : <ArrowUpDown className="h-3 w-3 text-white/25" />}
                                                    </button>
                                                ) : (
                                                    h.label
                                                )}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedRows.map((r) => {
                                        const ourMoney = fmtMoney(r.ourExpected, r.ourCurrency);
                                        const catdbMoney = r.catdb.status === "COMPLETE" ? fmtMoney(r.catdb.totalPrice, r.catdb.currency) : null;
                                        return (
                                            <tr key={r.id} className="odd:bg-white/[0.02]">
                                                <td className="px-3 py-2 border-b border-white/5 text-white/85 whitespace-nowrap max-w-[220px] truncate" title={r.vehicleLabel}>{r.vehicleLabel}</td>
                                                <td className="px-3 py-2 border-b border-white/5 text-white/60 font-mono whitespace-nowrap">{r.vin || "—"}</td>
                                                <td className="px-3 py-2 border-b border-white/5 whitespace-nowrap">
                                                    {catdbMoney ? (
                                                        <span className="text-white/85 font-semibold">{catdbMoney}</span>
                                                    ) : (
                                                        <span className="text-white/30 italic">not connected</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 border-b border-white/5 whitespace-nowrap">
                                                    {ourMoney ? <span className="text-emerald-300 font-semibold">{ourMoney}</span> : <span className="text-white/30 italic">no internal data</span>}
                                                </td>
                                                <td className="px-3 py-2 border-b border-white/5 whitespace-nowrap text-white/50">
                                                    {r.difference !== null ? fmtMoney(r.difference, r.ourCurrency) : "—"}
                                                </td>
                                                <td className="px-3 py-2 border-b border-white/5 whitespace-nowrap">
                                                    <span className={r.status === "ERROR" || r.error ? "text-rose-300" : r.status === "DONE" ? "text-emerald-300" : "text-white/60"}>
                                                        {r.status || (r.error ? "ERROR" : "—")}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 border-b border-white/5 whitespace-nowrap">
                                                    {(r.raw.result || r.raw.error) && (
                                                        <button type="button" onClick={() => setOpenRow(r)} className="inline-flex items-center gap-1 text-white/50 hover:text-white">
                                                            <Eye className="h-3.5 w-3.5" />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            <RowDetailModal row={openRow} onClose={() => setOpenRow(null)} />
        </div>
    );
}
