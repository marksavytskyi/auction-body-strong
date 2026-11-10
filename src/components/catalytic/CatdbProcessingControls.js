"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";

import {
    cancelAllPending,
    clearWorkerStop,
    getControlStatus,
    pauseProcessing,
    resumeProcessing,
    stopWorker,
} from "@/lib/catalytic/catdbAdmin";
import { CatalyticApiError } from "@/lib/catalytic/api";
import { useModalLayer } from "@/hooks/useModalLayer";
import { isPageHidden } from "@/lib/pageVisibility";

const POLL_MS = 15_000;

const STOP_STATE = {
    NONE: { label: "No stop requested", tone: "text-white/50" },
    // Never shown as stopped: the request may not have reached the device.
    REQUEST_SENT: { label: "Stop: REQUEST SENT, not acknowledged", tone: "text-amber-300" },
    WORKER_STOPPED: { label: "Stop: WORKER STOPPED (device confirmed)", tone: "text-emerald-300" },
};

const ACTIONS = {
    pause: {
        title: "Pause processing?",
        body: "Devices get no new jobs and no permission to start a search. Nothing is cancelled, and a search already submitted can finish.",
        confirm: "Pause",
    },
    resume: {
        title: "Resume processing?",
        body: "Devices can claim eligible jobs again, and each search can use paid quota. Cancelled jobs stay cancelled.",
        confirm: "Resume",
    },
    cancelAll: {
        title: "Cancel all pending jobs?",
        body: "Cancels every pending or running job with no submitted search. Completed results and history are kept. A search already submitted can't be stopped; its result is still saved. This can't be undone.",
        confirm: "Cancel jobs",
    },
    stop: {
        title: "Stop this device?",
        body: "Sends a stop request. The backend immediately refuses this device new jobs and new searches. It counts as stopped only after the device confirms. A search already in progress can't be interrupted.",
        confirm: "Send stop request",
    },
};

function fmtDate(value) {
    if (!value) return "never";
    // The API sends UTC without a zone.
    const date = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

// children and confirmDisabled let a caller ask for more than one click, such as typing an email.
export function ConfirmDialog({ action, busy, onConfirm, onClose, children = null, confirmDisabled = false }) {
    const zIndex = useModalLayer(true, busy ? undefined : onClose);
    return createPortal(
        <div
            role="dialog"
            aria-modal="true"
            aria-label={action.title}
            style={{ zIndex }}
            className="fixed inset-0 flex items-center justify-center bg-black/80 p-3"
            onClick={busy ? undefined : onClose}
        >
            <div className="w-full max-w-md space-y-3 rounded-2xl border border-white/10 bg-[#0b0d12] p-5" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-base font-bold text-white">{action.title}</h2>
                <p className="text-sm text-white/70">{action.body}</p>
                {children}
                <div className="flex justify-end gap-2 pt-1">
                    <button type="button" disabled={busy} onClick={onClose} className="h-10 rounded-xl border border-white/15 px-4 text-sm font-bold text-white/80 disabled:opacity-40">
                        Go back
                    </button>
                    <button type="button" disabled={busy || confirmDisabled} onClick={onConfirm} className="inline-flex h-10 items-center gap-2 rounded-xl bg-rose-500 px-4 text-sm font-bold text-white disabled:opacity-60">
                        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                        {action.confirm}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

export default function CatdbProcessingControls({ onChanged }) {
    const [status, setStatus] = useState(null);
    const [loadError, setLoadError] = useState("");
    const [pending, setPending] = useState(null);
    const [busy, setBusy] = useState(false);
    // A second tap can land before React re-renders with busy=true.
    const running = useRef(false);

    const load = useCallback(async () => {
        try {
            setStatus(await getControlStatus());
            setLoadError("");
        } catch (error) {
            setLoadError(error instanceof CatalyticApiError ? error.message : "Failed to load CatDB processing status");
        }
    }, []);

    useEffect(() => {
        load();
        const timer = setInterval(() => {
            if (!isPageHidden()) load();
        }, POLL_MS);
        return () => clearInterval(timer);
    }, [load]);

    const perform = async () => {
        if (running.current || !pending) return;
        running.current = true;
        setBusy(true);
        try {
            if (pending.kind === "pause") {
                setStatus(await pauseProcessing());
                toast.success("Processing paused");
            } else if (pending.kind === "resume") {
                setStatus(await resumeProcessing());
                toast.success("Processing resumed");
            } else if (pending.kind === "cancelAll") {
                const result = await cancelAllPending();
                const inFlight = result.search_already_submitted_job_ids.length;
                toast.success(
                    `${result.cancelled_job_ids.length} cancelled` +
                        (inFlight ? `; ${inFlight} already submitted and can't be stopped` : "")
                );
                await load();
            } else if (pending.kind === "stop") {
                setStatus(await stopWorker(pending.workerId));
                toast.success("Stop request sent. Waiting for the device to confirm.");
            }
            onChanged?.();
            setPending(null);
        } catch (error) {
            toast.error(error instanceof CatalyticApiError ? error.message : "Action failed");
        } finally {
            running.current = false;
            setBusy(false);
        }
    };

    const clearStop = async (workerId) => {
        if (running.current) return;
        running.current = true;
        setBusy(true);
        try {
            setStatus(await clearWorkerStop(workerId));
            toast.success("Stop request cleared");
        } catch (error) {
            toast.error(error instanceof CatalyticApiError ? error.message : "Action failed");
        } finally {
            running.current = false;
            setBusy(false);
        }
    };

    if (!status) {
        return (
            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/60">
                {loadError ? (
                    <span className="flex items-center justify-between gap-3 text-rose-300">
                        {loadError}
                        <button type="button" onClick={load} className="underline">Retry</button>
                    </span>
                ) : (
                    "Loading processing status…"
                )}
            </section>
        );
    }

    const queued = status.pending + status.leased;
    const counts = [
        ["Queued", queued],
        ["Running", status.running],
        ["Search in flight", status.search_in_flight_job_ids.length],
        ["Cancelled", status.cancelled],
    ];

    return (
        <section aria-label="CatDB processing controls" className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            {loadError && <p role="alert" className="text-xs text-rose-300">Status may be out of date: {loadError}</p>}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className={`text-sm font-black uppercase ${status.paused ? "text-amber-300" : "text-emerald-300"}`}>
                    Processing: {status.paused ? "Paused" : "Running"}
                </div>
                <div className="flex flex-wrap gap-2">
                    {status.paused ? (
                        <button type="button" onClick={() => setPending({ kind: "resume" })} className="h-10 rounded-xl border border-white/15 px-3 text-xs font-bold text-white/90">
                            Resume Processing
                        </button>
                    ) : (
                        <button type="button" onClick={() => setPending({ kind: "pause" })} className="h-10 rounded-xl bg-amber-400 px-3 text-xs font-bold text-black">
                            Pause Processing
                        </button>
                    )}
                    <button type="button" disabled={status.pending + status.leased + status.running === 0} onClick={() => setPending({ kind: "cancelAll" })} className="h-10 rounded-xl border border-rose-500/40 px-3 text-xs font-bold text-rose-300 disabled:opacity-40">
                        Cancel All Pending
                    </button>
                </div>
            </div>

            <dl className="grid grid-cols-4 gap-2 text-center">
                {counts.map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-white/10 p-2">
                        <dd className="text-lg font-black text-white/90">{value}</dd>
                        <dt className="text-[10px] text-white/50">{label}</dt>
                    </div>
                ))}
            </dl>

            {status.workers.map((worker) => {
                const stop = STOP_STATE[worker.stop_state] || STOP_STATE.NONE;
                return (
                    <div key={worker.id} className="space-y-1 rounded-xl border border-white/10 p-3 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm font-bold text-white/90">
                                {worker.name} (#{worker.id}): {worker.is_active ? worker.effective_status : "REVOKED"}
                            </span>
                            {worker.stop_state === "NONE" ? (
                                <button type="button" onClick={() => setPending({ kind: "stop", workerId: worker.id })} className="h-9 rounded-lg border border-rose-500/40 px-3 font-bold text-rose-300">
                                    Stop Active Worker
                                </button>
                            ) : (
                                <button type="button" disabled={busy} onClick={() => clearStop(worker.id)} className="h-9 rounded-lg border border-white/15 px-3 font-bold text-white/70 disabled:opacity-40">
                                    Clear Stop Request
                                </button>
                            )}
                        </div>
                        <div className="text-white/60">Last heartbeat: {fmtDate(worker.last_seen_at)}</div>
                        <div className="text-white/60">
                            Current job: {worker.current_job_id ? `#${worker.current_job_id}` : "none"}
                            {worker.current_vin && <span className="font-mono"> · {worker.current_vin}</span>}
                        </div>
                        <div className={stop.tone}>{stop.label}</div>
                        {worker.last_error && <div className="break-words text-white/40">Last error: {worker.last_error}</div>}
                    </div>
                );
            })}

            {pending && (
                <ConfirmDialog action={ACTIONS[pending.kind]} busy={busy} onConfirm={perform} onClose={() => setPending(null)} />
            )}
        </section>
    );
}
