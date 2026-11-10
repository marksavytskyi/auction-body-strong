"use client";

import React, { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";

import { archiveJobs, listJobTable } from "@/lib/catalytic/catdbAdmin";
import { CatalyticApiError } from "@/lib/catalytic/http";
import { FINISHED_STATUSES, OUTCOME_FILTERS, OUTCOME_LABEL, OUTCOME_TONE } from "@/lib/catalytic/catdbJobs";
import { isAll, showingLabel } from "@/lib/pagination";
import usePageSize from "@/hooks/usePageSize";
import usePagedRows from "@/hooks/usePagedRows";
import useColumnVisibility from "@/hooks/useColumnVisibility";
import PageSizeSelect from "@/components/ui/PageSizeSelect";
import LoadMoreRows from "@/components/ui/LoadMoreRows";
import ColumnsMenu from "@/components/ui/ColumnsMenu";
import { ConfirmDialog } from "@/components/catalytic/CatdbProcessingControls";
import CatdbJobDetails from "./CatdbJobDetails";

// Phase K.51 — the CatDB Automation jobs table. Reading, filtering, paging and
// archiving never queue or retry anything; a retry only happens from a job's details,
// after the person confirms it may use a paid search.

function fmt(value) {
    if (!value) return "—";
    const d = new Date(`${value}`.endsWith("Z") ? value : `${value}Z`);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

function Outcome({ job }) {
    return (
        <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${OUTCOME_TONE[job.outcome] || "border-white/15 text-white/60"}`}>
            {OUTCOME_LABEL[job.outcome] || job.outcome}
        </span>
    );
}

const td = "px-3 py-2 border-b border-white/5";
const COLUMNS = [
    { id: "vin", label: "VIN", required: true, cell: (j) => <td key="vin" className={`${td} font-mono text-white/80 whitespace-nowrap`}>{j.vin}</td> },
    { id: "vehicle", label: "Vehicle", cell: (j) => <td key="vehicle" className={`${td} text-white/70 whitespace-nowrap`}>{j.vehicle || "—"}</td> },
    { id: "status", label: "Status", cell: (j) => <td key="status" className={`${td} whitespace-nowrap`}><Outcome job={j} />{j.archived_at && <span className="ml-1.5 text-[10px] text-white/35">archived</span>}</td> },
    { id: "attempts", label: "Attempts", cell: (j) => <td key="attempts" className={`${td} text-white/60 whitespace-nowrap`}>{j.attempt_count}/{j.max_attempts}</td> },
    { id: "device", label: "Device", cell: (j) => <td key="device" className={`${td} text-white/60 whitespace-nowrap`}>{j.worker_name || (j.worker_id ? `#${j.worker_id}` : "—")}</td> },
    { id: "created", label: "Created", cell: (j) => <td key="created" className={`${td} text-white/40 whitespace-nowrap`}>{fmt(j.created_at)}</td> },
    { id: "updated", label: "Updated", cell: (j) => <td key="updated" className={`${td} text-white/40 whitespace-nowrap`}>{fmt(j.updated_at)}</td> },
    { id: "error", label: "Error", cell: (j) => <td key="error" className={`${td} text-rose-300/80 max-w-[220px] truncate`} title={j.error_message || undefined}>{j.error_code || j.error_message || "—"}</td> },
];

const SORTS = [{ id: "newest", label: "Newest first" }, { id: "oldest", label: "Oldest first" }, { id: "updated", label: "Recently updated" }];

export default function CatdbJobsPanel({ refreshKey, onChanged }) {
    const [search, setSearch] = useState("");
    const [debounced, setDebounced] = useState("");
    const [outcome, setOutcome] = useState("");
    const [sort, setSort] = useState("newest");
    const [showArchived, setShowArchived] = useState(false);
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = usePageSize("catdb:jobs:page-size", 100);
    const [localRefresh, setLocalRefresh] = useState(0);
    const [selected, setSelected] = useState([]);
    const [detailsId, setDetailsId] = useState(null);
    const [pending, setPending] = useState(null); // { kind: "selected" } | { kind: "finished" }
    const [finishedStatuses, setFinishedStatuses] = useState(["COMPLETED", "CANCELLED"]);
    const [busy, setBusy] = useState(false);
    const columns = useColumnVisibility("catdb:jobs:columns", COLUMNS);

    useEffect(() => {
        const t = setTimeout(() => setDebounced(search.trim()), 300);
        return () => clearTimeout(t);
    }, [search]);
    useEffect(() => { setPage(0); setSelected([]); }, [debounced, outcome, sort, showArchived]);

    const fetchPage = useCallback((limit, offset) => listJobTable({
        limit, offset, sort, status: outcome || undefined, search: debounced || undefined,
        ...(showArchived ? { include_archived: true } : {}),
    }), [sort, outcome, debounced, showArchived]);
    const { rows, total, loading, loadingMore, loadMoreFailed, error, hasMore, loadMore } = usePagedRows({
        fetchPage, pageSize, page, refreshKey: `${refreshKey}-${localRefresh}`,
    });
    const all = isAll(pageSize);
    const totalPages = all ? 1 : Math.max(1, Math.ceil(total / pageSize));
    const changed = () => { setLocalRefresh((k) => k + 1); onChanged?.(); };
    const toggle = (id) => setSelected((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
    const archivable = (rows || []).filter((j) => j.can_archive);

    const confirmArchive = async () => {
        setBusy(true);
        try {
            const result = await archiveJobs(pending.kind === "selected" ? { jobIds: selected } : { statuses: finishedStatuses });
            toast.success(`${result.archived} job${result.archived === 1 ? "" : "s"} archived${result.skipped_active_job_ids.length ? `; ${result.skipped_active_job_ids.length} still active, left as they are` : ""}`);
            setPending(null);
            setSelected([]);
            changed();
        } catch (e) {
            toast.error(e instanceof CatalyticApiError ? e.message : "Failed to archive");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-0 flex-1 sm:max-w-xs">
                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search VIN" aria-label="Search VIN"
                        className="h-10 w-full rounded-xl border border-white/10 bg-white/5 pl-9 pr-3 text-base text-white outline-none sm:h-9 sm:text-xs" />
                </div>
                <select aria-label="Status" value={outcome} onChange={(e) => setOutcome(e.target.value)} className="h-10 rounded-xl border border-white/10 bg-[#0b0d12] px-2 text-xs text-white/80 sm:h-9">
                    {OUTCOME_FILTERS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
                <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value)} className="h-10 rounded-xl border border-white/10 bg-[#0b0d12] px-2 text-xs text-white/80 sm:h-9">
                    {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
                <label className="inline-flex items-center gap-1.5 text-xs text-white/60">
                    <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="h-4 w-4" /> Show archived
                </label>
                <ColumnsMenu columns={COLUMNS} isVisible={columns.isVisible} onToggle={columns.toggle} onShowAll={columns.showAll} onHideAll={columns.hideAll} onReset={columns.reset} />
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
                <button type="button" disabled={!selected.length} onClick={() => setPending({ kind: "selected" })}
                    className="h-9 rounded-lg border border-white/15 px-3 font-bold text-white/80 disabled:opacity-40">Archive selected ({selected.length})</button>
                <button type="button" onClick={() => setPending({ kind: "finished" })} className="h-9 rounded-lg border border-white/15 px-3 font-bold text-white/80">
                    Archive finished jobs…
                </button>
                <span className="text-[11px] text-white/35">Archiving only hides a job here. Its result, history and paid-search accounting stay.</span>
            </div>

            {error ? (
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">{error instanceof CatalyticApiError ? error.message : "Failed to load jobs"}</div>
            ) : rows === null ? (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-white/40"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
            ) : !rows.length ? (
                <div className="text-xs italic text-white/35">{debounced || outcome || showArchived ? "No jobs match." : "No jobs yet."}</div>
            ) : (
                <div className={loading ? "space-y-3 opacity-60" : "space-y-3"}>
                    <div className="hidden max-h-[60vh] overflow-auto rounded-xl border border-white/10 bg-black/25 md:block">
                        <table className="w-full text-xs">
                            <thead className="sticky top-0 bg-black/60">
                                <tr>
                                    <th className="border-b border-white/10 px-3 py-2">
                                        <input type="checkbox" aria-label="Select every finished job shown" className="h-4 w-4"
                                            checked={archivable.length > 0 && archivable.every((j) => selected.includes(j.id))}
                                            onChange={(e) => setSelected(e.target.checked ? archivable.map((j) => j.id) : [])} />
                                    </th>
                                    {columns.visible.map((c) => <th key={c.id} className="border-b border-white/10 px-3 py-2 text-left font-bold uppercase tracking-wider text-white/50 whitespace-nowrap">{c.label}</th>)}
                                    <th className="border-b border-white/10 px-3 py-2"><span className="sr-only">Actions</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((j) => (
                                    <tr key={j.id} className="odd:bg-white/[0.02]">
                                        <td className={td}>
                                            <input type="checkbox" aria-label={`Select job ${j.id}`} disabled={!j.can_archive} checked={selected.includes(j.id)} onChange={() => toggle(j.id)} className="h-4 w-4" />
                                        </td>
                                        {columns.visible.map((c) => c.cell(j))}
                                        <td className={`${td} whitespace-nowrap`}>
                                            <button type="button" onClick={() => setDetailsId(j.id)} className="rounded-lg border border-white/15 px-2 py-1 font-bold text-white/80">Details</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <LoadMoreRows hasMore={hasMore} loading={loadingMore} failed={loadMoreFailed} onLoadMore={loadMore} loadedCount={rows.length} />
                    </div>
                    <div className="space-y-2 md:hidden" aria-label="Jobs">
                        {rows.map((j) => (
                            <button key={j.id} type="button" onClick={() => setDetailsId(j.id)} className="w-full space-y-1 rounded-xl border border-white/10 bg-black/25 p-3 text-left">
                                <div className="flex items-center justify-between gap-2"><span className="font-mono text-xs text-white/85">{j.vin}</span><Outcome job={j} /></div>
                                <div className="text-[11px] text-white/45">{j.vehicle || "—"} · {fmt(j.updated_at)}</div>
                                {j.error_code && <div className="truncate text-[11px] text-rose-300/80">{j.error_code}</div>}
                            </button>
                        ))}
                        <LoadMoreRows hasMore={hasMore} loading={loadingMore} failed={loadMoreFailed} onLoadMore={loadMore} loadedCount={rows.length} />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-white/40">
                        <span>
                            {showingLabel({ pageSize, page, shown: rows.length, total, noun: "job" })}
                            {!all && totalPages > 1 && <> · page {page + 1} of {totalPages}</>}
                        </span>
                        <div className="flex items-center gap-2">
                            <PageSizeSelect value={pageSize} onChange={(next) => { setPage(0); setPageSize(next); }} />
                            {!all && (
                                <>
                                    <button type="button" aria-label="Previous page" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}
                                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 disabled:opacity-30 sm:h-8 sm:w-8"><ChevronLeft className="h-4 w-4" /></button>
                                    <button type="button" aria-label="Next page" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}
                                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 disabled:opacity-30 sm:h-8 sm:w-8"><ChevronRight className="h-4 w-4" /></button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {detailsId && <CatdbJobDetails jobId={detailsId} onClose={() => setDetailsId(null)} onChanged={changed} />}
            {pending && (
                <ConfirmDialog
                    action={pending.kind === "selected"
                        ? { title: `Archive ${selected.length} job${selected.length === 1 ? "" : "s"}?`, body: "They leave this list. Their results, history, snapshots and paid-search accounting stay, and Show archived brings them back.", confirm: "Archive" }
                        : { title: "Archive finished jobs?", body: "Every finished job with the statuses below leaves the list. Queued and running jobs are never archived. Nothing else about them changes.", confirm: "Archive" }}
                    busy={busy}
                    onConfirm={confirmArchive}
                    onClose={() => setPending(null)}
                    confirmDisabled={pending.kind === "finished" && finishedStatuses.length === 0}
                >
                    {pending.kind === "finished" && (
                        <div className="flex flex-wrap gap-3 text-xs text-white/70">
                            {FINISHED_STATUSES.map((status) => (
                                <label key={status} className="inline-flex items-center gap-1.5">
                                    <input type="checkbox" className="h-4 w-4" checked={finishedStatuses.includes(status)}
                                        onChange={(e) => setFinishedStatuses((list) => (e.target.checked ? [...list, status] : list.filter((s) => s !== status)))} />
                                    {OUTCOME_LABEL[status] || status}
                                </label>
                            ))}
                        </div>
                    )}
                </ConfirmDialog>
            )}
        </div>
    );
}

