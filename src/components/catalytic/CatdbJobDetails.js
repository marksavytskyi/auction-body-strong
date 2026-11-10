"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { Loader2, X } from "lucide-react";

import { archiveJobs, cancelJob, getJobDetails, retryJob, unarchiveJobs } from "@/lib/catalytic/catdbAdmin";
import { CatalyticApiError } from "@/lib/catalytic/http";
import { useModalLayer } from "@/hooks/useModalLayer";
import { OUTCOME_LABEL, OUTCOME_TONE } from "@/lib/catalytic/catdbJobs";

// Phase K.51: one CatDB job, everything stored about it, and the few safe actions.
// Retrying queues one new job for the VIN only after the person ticks that it may use
// a paid search; nothing here runs a search by itself.

function fmt(value) {
    if (!value) return "—";
    const d = new Date(`${value}`.endsWith("Z") ? value : `${value}Z`);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

const button = "h-10 rounded-xl border px-3 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed sm:h-9";

function Field({ label, children }) {
    return (
        <div>
            <dt className="text-[10px] font-bold uppercase tracking-wider text-white/40">{label}</dt>
            <dd className="text-xs text-white/80 break-words">{children ?? "—"}</dd>
        </div>
    );
}

export default function CatdbJobDetails({ jobId, onClose, onChanged }) {
    const [job, setJob] = useState(null);
    const [error, setError] = useState("");
    const [confirming, setConfirming] = useState(null); // "retry" | "cancel"
    const [acknowledged, setAcknowledged] = useState(false);
    const [busy, setBusy] = useState(false);
    const zIndex = useModalLayer(true, busy ? undefined : onClose);

    const load = useCallback(async () => {
        try {
            setJob(await getJobDetails(jobId));
            setError("");
        } catch (e) {
            setError(e instanceof CatalyticApiError ? e.message : "Failed to load the job");
        }
    }, [jobId]);

    useEffect(() => { load(); }, [load]);

    const act = async (fn, message) => {
        setBusy(true);
        try {
            const result = await fn();
            toast.success(typeof message === "function" ? message(result) : message);
            setConfirming(null);
            setAcknowledged(false);
            await load();
            onChanged?.();
        } catch (e) {
            toast.error(e instanceof CatalyticApiError ? e.message : "That didn't go through");
        } finally {
            setBusy(false);
        }
    };

    const retryBlocked = job && (job.active_job_for_vin ? `Job #${job.active_job_for_vin} for this VIN is already queued or running` : !job.can_retry ? "Only failed, cancelled or held jobs can be retried" : null);

    return createPortal(
        <div role="dialog" aria-modal="true" aria-label={`CatDB job #${jobId}`} style={{ zIndex }}
            className="fixed inset-0 flex items-end justify-center bg-black/80 sm:items-center sm:p-3" onClick={busy ? undefined : onClose}>
            <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-t-2xl border border-white/10 bg-[#0b0d12] sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start justify-between gap-3 border-b border-white/10 p-4">
                    <div className="min-w-0">
                        <h2 className="font-mono text-base font-bold text-white">{job?.vin || `Job #${jobId}`}</h2>
                        <div className="text-[11px] text-white/45">Job #{jobId}{job?.vehicle ? ` · ${job.vehicle}` : ""}</div>
                    </div>
                    <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white/60 hover:bg-white/10">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="space-y-4 overflow-y-auto p-4">
                    {error ? (
                        <p className="text-sm text-rose-300">{error}</p>
                    ) : !job ? (
                        <div className="flex items-center justify-center gap-2 py-8 text-sm text-white/50"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
                    ) : (
                        <>
                            <div className={`rounded-xl border p-3 text-xs ${OUTCOME_TONE[job.outcome] || "border-white/10 text-white/70"}`}>
                                <div className="font-bold">{OUTCOME_LABEL[job.outcome] || job.outcome}{job.archived_at ? " · archived" : ""}</div>
                                <div className="mt-1 opacity-90">{job.outcome_text}</div>
                            </div>
                            <p className="text-xs text-white/60">{job.quota_note}</p>
                            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                <Field label="Status">{job.status}</Field>
                                <Field label="Attempts">{job.attempt_count}/{job.max_attempts}</Field>
                                <Field label="Searches submitted">{job.submission_count}</Field>
                                <Field label="Device">{job.worker_name || (job.worker_id ? `#${job.worker_id}` : null)}</Field>
                                <Field label="Queued">{fmt(job.queued_at)}</Field>
                                <Field label="Started">{fmt(job.started_at)}</Field>
                                <Field label="Search submitted">{fmt(job.search_submitted_at)}</Field>
                                <Field label="Finished">{fmt(job.completed_at || job.failed_at)}</Field>
                                <Field label="Last change">{fmt(job.updated_at)}</Field>
                            </dl>
                            {(job.error_code || job.error_message) && (
                                <div className="rounded-xl border border-white/10 bg-black/25 p-3 text-xs">
                                    <div className="font-bold text-white/70">{job.error_code || "Error"}</div>
                                    <div className="mt-1 whitespace-pre-wrap break-words text-white/60">{job.error_message || "—"}</div>
                                </div>
                            )}
                            <div className="text-xs text-white/60">
                                <div className="font-bold uppercase tracking-wider text-[10px] text-white/40 mb-1">Evidence</div>
                                {job.evidence ? (
                                    <>Snapshot #{job.evidence.snapshot_id}: {job.evidence.result_status}, {job.evidence.item_count} item{job.evidence.item_count === 1 ? "" : "s"}
                                        {job.evidence.catalyst_count != null && `, ${job.evidence.catalyst_count} converter${job.evidence.catalyst_count === 1 ? "" : "s"}`},
                                        {" "}{job.evidence.captured_pages} {job.evidence.evidence_kind}. Screenshots aren&apos;t stored.</>
                                ) : "No snapshot was stored for this job."}
                            </div>
                            {job.operations_batch_ids?.length > 0 && (
                                <div className="text-xs text-white/60">
                                    Used by Operations {job.operations_batch_ids.map((id, i) => (
                                        <React.Fragment key={id}>{i ? ", " : ""}<Link href={`/operations/${id}`} className="underline">Batch #{id}</Link></React.Fragment>
                                    ))}
                                </div>
                            )}
                            <div>
                                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-white/40">Every job for this VIN</div>
                                <ul className="space-y-1 text-xs">
                                    {job.history.map((h) => (
                                        <li key={h.id} className="flex flex-wrap justify-between gap-x-3 text-white/70">
                                            <span>#{h.id}{h.id === job.id ? " (this one)" : ""}{h.retry_of_job_id ? ` · retry of #${h.retry_of_job_id}` : ""} · {OUTCOME_LABEL[h.outcome] || h.outcome}</span>
                                            <span className="text-white/40">{fmt(h.created_at)}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {confirming === "retry" ? (
                                <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-3 text-xs text-amber-100">
                                    <div className="font-bold">Retry {job.vin}?</div>
                                    <p>This queues one new CatDB search for this VIN. It may use a paid search from your CatDB subscription. This job and its history stay as they are.
                                        {job.dispatch_paused ? " CatDB is paused, so the new job waits until processing is resumed." : " CatDB is running, so a device may pick it up right away."}</p>
                                    <label className="flex items-start gap-2">
                                        <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} className="mt-0.5 h-4 w-4" />
                                        I understand this may use a paid CatDB search
                                    </label>
                                    <div className="flex justify-end gap-2">
                                        <button type="button" disabled={busy} onClick={() => { setConfirming(null); setAcknowledged(false); }} className={`${button} border-white/15 text-white/80`}>Go back</button>
                                        <button type="button" disabled={busy || !acknowledged}
                                            onClick={() => act(() => retryJob(job.id), (r) => `Queued job #${r.id} for ${r.vin}`)}
                                            className={`${button} border-amber-500/50 bg-amber-500/20 text-amber-100`}>
                                            {busy ? "Queuing…" : "Queue the retry"}
                                        </button>
                                    </div>
                                </div>
                            ) : confirming === "cancel" ? (
                                <div className="space-y-2 rounded-xl border border-rose-500/30 bg-rose-500/[0.06] p-3 text-xs text-rose-100">
                                    <div className="font-bold">Cancel job #{job.id}?</div>
                                    <p>It won&apos;t be retried. A search already submitted can&apos;t be stopped; its result is still saved.</p>
                                    <div className="flex justify-end gap-2">
                                        <button type="button" disabled={busy} onClick={() => setConfirming(null)} className={`${button} border-white/15 text-white/80`}>Go back</button>
                                        <button type="button" disabled={busy} onClick={() => act(() => cancelJob(job.id), (r) => r.outcome === "SEARCH_ALREADY_SUBMITTED" ? "Not cancelled: its search was already submitted" : "Job cancelled")}
                                            className={`${button} border-rose-500/50 text-rose-200`}>Cancel job</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-wrap gap-2 border-t border-white/10 pt-3">
                                    <button type="button" disabled={Boolean(retryBlocked)} title={retryBlocked || undefined} onClick={() => setConfirming("retry")} className={`${button} border-amber-500/40 text-amber-200`}>
                                        Retry VIN…
                                    </button>
                                    {job.can_cancel && <button type="button" onClick={() => setConfirming("cancel")} className={`${button} border-rose-500/40 text-rose-300`}>Cancel…</button>}
                                    {job.archived_at ? (
                                        <button type="button" disabled={busy} onClick={() => act(() => unarchiveJobs([job.id]), "Job restored to the list")} className={`${button} border-white/15 text-white/80`}>Unarchive</button>
                                    ) : job.can_archive ? (
                                        <button type="button" disabled={busy} onClick={() => act(() => archiveJobs({ jobIds: [job.id] }), "Job archived")} className={`${button} border-white/15 text-white/80`}>Archive</button>
                                    ) : null}
                                    {retryBlocked && <span className="self-center text-[11px] text-white/40">{retryBlocked}</span>}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}
