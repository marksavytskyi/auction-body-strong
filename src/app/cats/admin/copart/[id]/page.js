"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, FileSpreadsheet, ArrowLeft, Search, RefreshCw } from "lucide-react";

import { getImport, listVehicles } from "@/lib/catalytic/copartImport";
import { getJob } from "@/lib/catalytic/catdbAdmin";
import { CatalyticApiError } from "@/lib/catalytic/api";
import { Input } from "@/components/ui/input";
import StatusPill from "@/components/catalytic/StatusPill";
import CreateCatdbBatchFlow from "@/components/catalytic/CreateCatdbBatchFlow";
import { useAdminTierGate } from "@/hooks/useRoleGate";

// Derived ONLY from fields the backend actually returns on
// GET /copart-import/imports/{id}/vehicles (row_valid, ready_for_catdb,
// catdb_job_id) plus, for the small subset that's actually queued, the
// real CatDB job status (reusing the existing GET /catdb/admin/jobs/{id} —
// no new backend endpoint). Never fabricated.
const STATUS_TONE = {
    INVALID: "danger",
    NOT_READY: "neutral",
    READY: "success",
    QUEUED: "info",
    PROCESSING: "progress",
    COMPLETED: "success",
    FAILED: "danger",
};

const FILTERS = [
    { id: "all", label: "All" },
    { id: "READY", label: "Ready" },
    { id: "QUEUED", label: "Queued" },
    { id: "PROCESSING", label: "Processing" },
    { id: "COMPLETED", label: "Completed" },
    { id: "FAILED", label: "Failed" },
    { id: "INVALID", label: "Invalid" },
];

// Keeps per-vehicle job enrichment from ever hammering the API: only the
// vehicles actually queued (bounded by batch sizes, max 10/batch) need a
// job lookup at all, and even that set is capped defensively.
const MAX_JOB_ENRICHMENT = 200;

function baseStatus(vehicle) {
    if (!vehicle.row_valid) return "INVALID";
    if (vehicle.catdb_job_id == null) return vehicle.ready_for_catdb ? "READY" : "NOT_READY";
    return null; // queued — resolved via job status below
}

const JOB_STATUS_MAP = { PENDING: "QUEUED", LEASED: "PROCESSING", RUNNING: "PROCESSING", COMPLETED: "COMPLETED", FAILED: "FAILED" };

function fmtDate(s) {
    if (!s) return "—";
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? s : d.toLocaleString();
}

export default function CopartImportDetailPage() {
    const { ready } = useAdminTierGate();
    const params = useParams();
    const router = useRouter();
    const importId = params?.id;

    const [imp, setImp] = useState(null);
    const [vehicles, setVehicles] = useState(null);
    const [jobStatusById, setJobStatusById] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [filter, setFilter] = useState("all");
    const [search, setSearch] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const [impData, vehicleData] = await Promise.all([getImport(importId), listVehicles(importId, { limit: 1000 })]);
            setImp(impData);
            const list = Array.isArray(vehicleData) ? vehicleData : [];
            setVehicles(list);

            const queuedJobIds = [...new Set(list.map((v) => v.catdb_job_id).filter((id) => id != null))].slice(0, MAX_JOB_ENRICHMENT);
            if (queuedJobIds.length) {
                const results = await Promise.all(
                    queuedJobIds.map((id) => getJob(id).catch(() => null))
                );
                const map = {};
                results.forEach((job, i) => { if (job) map[queuedJobIds[i]] = job.status; });
                setJobStatusById(map);
            } else {
                setJobStatusById({});
            }
        } catch (e) {
            setError(e instanceof CatalyticApiError ? e.message : "Failed to load import");
            setImp(null);
            setVehicles(null);
        } finally {
            setLoading(false);
        }
    }, [importId]);

    useEffect(() => {
        if (ready && importId) load();
    }, [ready, importId, load]);

    const rows = useMemo(() => {
        if (!vehicles) return [];
        return vehicles.map((v) => {
            const base = baseStatus(v);
            const status = base || JOB_STATUS_MAP[jobStatusById[v.catdb_job_id]] || "QUEUED";
            return { ...v, status };
        });
    }, [vehicles, jobStatusById]);

    const filtered = useMemo(() => {
        let out = rows;
        if (filter !== "all") out = out.filter((r) => r.status === filter);
        const q = search.trim().toLowerCase();
        if (q) {
            out = out.filter((r) =>
                [r.vin, r.lot_number, r.make, r.model].filter(Boolean).some((f) => String(f).toLowerCase().includes(q))
            );
        }
        return out;
    }, [rows, filter, search]);

    const counts = useMemo(() => {
        const c = { READY: 0, QUEUED: 0, PROCESSING: 0, COMPLETED: 0, FAILED: 0, INVALID: 0, NOT_READY: 0 };
        rows.forEach((r) => { c[r.status] = (c[r.status] || 0) + 1; });
        return c;
    }, [rows]);

    if (!ready || loading) {
        return <div className="flex items-center gap-2 text-white/50 text-sm py-16 justify-center"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
    }

    if (error || !imp) {
        return (
            <div className="space-y-4">
                <button onClick={() => router.push("/cats/admin/copart")} className="text-xs text-white/40 hover:text-white inline-flex items-center gap-1.5"><ArrowLeft className="h-3.5 w-3.5" /> Back to Imports</button>
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium">{error || "Import not found"}</div>
            </div>
        );
    }

    const stats = imp.stats || {};
    const readyCount = stats.ready_for_catdb_rows ?? 0;

    return (
        <div className="space-y-5">
            <button onClick={() => router.push("/cats/admin/copart")} className="text-xs text-white/40 hover:text-white inline-flex items-center gap-1.5"><ArrowLeft className="h-3.5 w-3.5" /> Back to Imports</button>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h1 className="text-xl font-black uppercase tracking-tight text-white/90 inline-flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5 text-sky-400" /> {imp.filename || `Import #${imp.id}`}
                    </h1>
                    <p className="text-xs text-white/40 mt-1">{fmtDate(imp.created_at)} · <StatusPill label={imp.status} tone={imp.status === "COMPLETED" ? "success" : imp.status === "FAILED" ? "danger" : "progress"} /></p>
                </div>
                <div className="flex items-center gap-2">
                    <button type="button" onClick={load} className="p-2 rounded-xl hover:bg-white/10 text-white/40 hover:text-white" title="Refresh"><RefreshCw className="h-4 w-4" /></button>
                    <CreateCatdbBatchFlow
                        copartImportId={imp.id}
                        readyCount={readyCount}
                        onStarted={(batchId) => router.push(`/cats/admin/catdb-batches/${batchId}`)}
                    />
                </div>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-7 gap-2.5">
                {[
                    { label: "Total", value: imp.total_rows },
                    { label: "Valid", value: imp.valid_rows },
                    { label: "Invalid", value: imp.invalid_rows, tone: "danger" },
                    { label: "Ready", value: readyCount, tone: "success" },
                    { label: "Queued", value: stats.queued_rows, tone: "info" },
                    { label: "Completed", value: stats.completed_rows, tone: "success" },
                    { label: "Failed", value: stats.failed_rows, tone: "danger" },
                ].map((s) => (
                    <div key={s.label} className={`rounded-xl border p-2.5 text-center ${s.tone === "danger" && s.value > 0 ? "border-rose-500/25 bg-rose-500/[0.05]" : "border-white/10 bg-black/25"}`}>
                        <div className={`text-lg font-black ${s.tone === "success" ? "text-emerald-300" : s.tone === "danger" ? "text-rose-300" : s.tone === "info" ? "text-sky-300" : "text-white/90"}`}>{s.value ?? 0}</div>
                        <div className="text-[9px] uppercase tracking-wider text-white/40 font-bold mt-0.5">{s.label}</div>
                    </div>
                ))}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-1.5 flex-wrap">
                    {FILTERS.map((f) => (
                        <button
                            key={f.id}
                            type="button"
                            onClick={() => setFilter(f.id)}
                            className={[
                                "px-3 h-8 rounded-xl text-[11px] font-bold uppercase tracking-wider border transition-all",
                                filter === f.id ? "bg-sky-500/15 border-sky-500/30 text-sky-300" : "border-white/10 text-white/45 hover:text-white hover:bg-white/5",
                            ].join(" ")}
                        >
                            {f.label}{f.id !== "all" ? ` (${counts[f.id] || 0})` : ""}
                        </button>
                    ))}
                </div>
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
                    <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search VIN, lot, make/model" className="h-9 pl-9 rounded-xl bg-white/5 border-white/10 text-xs" />
                </div>
            </div>

            {filtered.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/25 p-10 text-center text-sm text-white/45">
                    {rows.length === 0 ? "This import has no rows." : "No vehicles match the current filter/search."}
                </div>
            ) : (
                <>
                    {/* Desktop/tablet table */}
                    <div className="hidden sm:block overflow-x-auto rounded-2xl border border-white/10 bg-black/25">
                        <table className="w-full text-xs">
                            <thead className="bg-black/40">
                                <tr>
                                    {["Lot #", "Year", "Make", "Model", "Engine", "VIN", "Status", "CatDB"].map((h) => (
                                        <th key={h} className="px-3 py-2.5 text-left uppercase tracking-wider text-white/50 font-bold border-b border-white/10 whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((v) => (
                                    <tr key={v.id} className="odd:bg-white/[0.02]">
                                        <td className="px-3 py-2 border-b border-white/5 text-white/70 whitespace-nowrap">{v.lot_number || "—"}</td>
                                        <td className="px-3 py-2 border-b border-white/5 text-white/70 whitespace-nowrap">{v.year || "—"}</td>
                                        <td className="px-3 py-2 border-b border-white/5 text-white/80 whitespace-nowrap">{v.make || "—"}</td>
                                        <td className="px-3 py-2 border-b border-white/5 text-white/80 whitespace-nowrap">{v.model || "—"}</td>
                                        <td className="px-3 py-2 border-b border-white/5 text-white/50 whitespace-nowrap">{v.engine || "—"}</td>
                                        <td className="px-3 py-2 border-b border-white/5 text-white/35 font-mono whitespace-nowrap">{v.vin || v.source_vin || "—"}</td>
                                        <td className="px-3 py-2 border-b border-white/5"><StatusPill label={v.status.replace("_", " ")} tone={STATUS_TONE[v.status] || "neutral"} /></td>
                                        <td className="px-3 py-2 border-b border-white/5 text-white/40 whitespace-nowrap">{v.catdb_job_id ? `job #${v.catdb_job_id}` : "—"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile cards */}
                    <div className="sm:hidden space-y-2">
                        {filtered.map((v) => (
                            <div key={v.id} className="rounded-xl border border-white/10 bg-black/25 p-3 space-y-1.5">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="text-sm font-bold text-white/90 truncate">{[v.year, v.make, v.model].filter(Boolean).join(" ") || "Unknown vehicle"}</div>
                                    <StatusPill label={v.status.replace("_", " ")} tone={STATUS_TONE[v.status] || "neutral"} />
                                </div>
                                <div className="text-[11px] text-white/40 font-mono truncate">{v.vin || v.source_vin || "—"}</div>
                                <div className="text-[11px] text-white/35">Lot {v.lot_number || "—"} · {v.engine || "no engine data"}{v.catdb_job_id ? ` · job #${v.catdb_job_id}` : ""}</div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
