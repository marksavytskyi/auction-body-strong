"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import Link from "next/link";
import { AlertTriangle, Database, Loader2, Search } from "lucide-react";

import {
    cancelOperationsCatalyticRemaining,
    getOperationsCatalytic,
    runOperationsLocalSearch,
    saveOperationsCatalyticSources,
} from "@/lib/operations/api";
import { pauseProcessing, stopWorker } from "@/lib/catalytic/catdbAdmin";
import { CatalyticApiError } from "@/lib/catalytic/http";
import { isPageHidden } from "@/lib/pageVisibility";
import { CATALYTIC_SOURCE_LABEL, CATALYTIC_STATUS_LABEL, CATALYTIC_STATUS_TONE } from "@/lib/operations/constants";
import StatusPill from "@/components/catalytic/StatusPill";
import { ConfirmDialog } from "@/components/catalytic/CatdbProcessingControls";
import CatdbSection from "./CatdbSection";

const POLL_MS = 15_000;

const SOURCE_HINT = {
    CATDB_VIN: "Paid VIN lookup using Android Worker",
    CATDB_LOCAL: "Search previously stored CatDB data",
    ECOTRADE_LOCAL: "Search previously stored EcoTrade data",
};

const SOURCE_FIELD = { CATDB_VIN: "run_catdb", CATDB_LOCAL: "run_catdb_local", ECOTRADE_LOCAL: "run_ecotrade_local" };

const ACTIONS = {
    pause: {
        title: "Pause CatDB for all batches?",
        body: "Devices get no new jobs and no permission to start a search, in every batch. Nothing is cancelled. Resuming is done in CatDB administration.",
        confirm: "Pause",
    },
    stop: {
        title: "Stop all CatDB devices?",
        body: "Sends each device a stop request, in every batch. A search already in progress can't be interrupted. Clearing the request is done in CatDB administration.",
        confirm: "Send stop request",
    },
    cancel: {
        title: "Cancel this batch's remaining searches?",
        body: "Cancels this batch's jobs that have not submitted a search. Completed results are kept, used quota is not refunded, and a search already submitted is not retried.",
        confirm: "Cancel remaining",
    },
};

const secondary = "h-10 rounded-xl border border-white/15 px-3 text-xs font-bold text-white/85 disabled:opacity-40";

export default function CatalyticProcessingCard({ batchId, refreshKey, selectedVehicleIds = [], onChanged }) {
    const [overview, setOverview] = useState(null);
    const [draft, setDraft] = useState(null);
    const [scope, setScope] = useState("ALL");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState("");
    const [pending, setPending] = useState(null);
    const running = useRef(false);

    const load = useCallback(async () => {
        try {
            const data = await getOperationsCatalytic(batchId);
            setOverview(data);
            setDraft((d) => d || Object.fromEntries(data.sources.map((s) => [s.source, s.selected])));
            setError("");
            return data;
        } catch (e) {
            setError(e instanceof CatalyticApiError ? e.message : "Failed to load catalytic processing");
            return null;
        }
    }, [batchId]);

    useEffect(() => { load(); }, [load, refreshKey]);

    // Only while this batch has jobs out, so a settled batch makes no requests.
    const activeJobs = overview?.active_job_count ?? 0;
    useEffect(() => {
        if (!activeJobs) return undefined;
        const timer = setInterval(() => { if (!isPageHidden()) onChanged?.(); }, POLL_MS);
        return () => clearInterval(timer);
    }, [activeJobs, onChanged]);

    const perform = async (name, fn) => {
        if (running.current) return;
        running.current = true;
        setBusy(name);
        try {
            await fn();
            await load();
            onChanged?.();
        } catch (e) {
            toast.error(e instanceof CatalyticApiError ? e.message : "Action failed");
        } finally {
            running.current = false;
            setBusy("");
            setPending(null);
        }
    };

    if (!overview || !draft) {
        return (
            <section aria-label="Catalytic processing" className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-white/50">
                {error ? (
                    <span className="flex items-center justify-between gap-3 text-rose-300">
                        {error}
                        <button type="button" onClick={load} className="underline">Retry</button>
                    </span>
                ) : "Loading catalytic processing…"}
            </section>
        );
    }

    const saved = Object.fromEntries(overview.sources.map((s) => [s.source, s.selected]));
    const dirty = overview.sources.some((s) => draft[s.source] !== saved[s.source]);
    const localSelected = saved.CATDB_LOCAL || saved.ECOTRADE_LOCAL;
    const counts = overview.scope_counts;
    const scopes = [
        { id: "ALL", label: "All vehicles", count: counts.ALL },
        { id: "SELECTED", label: "Selected vehicles", count: selectedVehicleIds.length },
        { id: "NO_LOCAL_MATCH", label: "Without a local match", count: counts.NO_LOCAL_MATCH },
        { id: "FAILED", label: "Failed, eligible for retry", count: counts.FAILED },
    ];
    const affected = scopes.find((s) => s.id === scope)?.count ?? 0;
    const paidScopeCount = scope === "FAILED" ? counts.PAID_FAILED : affected;
    const stoppable = overview.workers.filter((w) => w.stop_state === "NONE");

    const save = () => perform("save", async () => {
        await saveOperationsCatalyticSources(batchId, {
            run_catdb: draft.CATDB_VIN, run_catdb_local: draft.CATDB_LOCAL, run_ecotrade_local: draft.ECOTRADE_LOCAL,
        });
        toast.success("Sources saved");
    });

    const runLocal = () => perform("local", async () => {
        const result = await runOperationsLocalSearch(batchId, { scope, vehicleIds: scope === "SELECTED" ? selectedVehicleIds : undefined });
        toast.success(`Local search finished: ${result.vehicles_searched} vehicle${result.vehicles_searched === 1 ? "" : "s"}`);
    });

    const confirmAction = () => {
        if (pending === "pause") {
            perform("pause", async () => { await pauseProcessing(); toast.success("CatDB paused"); });
        } else if (pending === "stop") {
            perform("stop", async () => {
                for (const worker of stoppable) await stopWorker(worker.id);
                toast.success("Stop request sent. Waiting for the device to confirm.");
            });
        } else if (pending === "cancel") {
            perform("cancel", async () => {
                const result = await cancelOperationsCatalyticRemaining(batchId);
                const inFlight = result.search_already_submitted_job_ids.length;
                toast.success(`${result.cancelled_job_ids.length} cancelled${inFlight ? `; ${inFlight} already submitted and can't be stopped` : ""}`);
            });
        }
    };

    return (
        <section aria-label="Catalytic processing" className="space-y-4 rounded-2xl border border-white/10 bg-black/25 p-4">
            <h2 className="inline-flex items-center gap-2 text-sm font-bold text-white/90">
                <Database className="h-4 w-4 text-emerald-400" /> Catalytic Processing
            </h2>

            <div className="space-y-2">
                {overview.sources.map((source) => (
                    <div key={source.source} className="flex flex-wrap items-start justify-between gap-2">
                        <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2.5 text-xs text-white/85">
                            <input
                                type="checkbox"
                                checked={Boolean(draft[source.source])}
                                onChange={(e) => setDraft((d) => ({ ...d, [source.source]: e.target.checked }))}
                                className="mt-0.5 h-4 w-4 shrink-0"
                            />
                            <span className="min-w-0">
                                <span className="font-bold">{CATALYTIC_SOURCE_LABEL[source.source]}</span>
                                <span className="block text-[11px] text-white/40">{SOURCE_HINT[source.source]}</span>
                            </span>
                        </label>
                        <StatusPill label={CATALYTIC_STATUS_LABEL[source.status] || source.status} tone={CATALYTIC_STATUS_TONE[source.status] || "neutral"} />
                    </div>
                ))}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button type="button" disabled={!dirty || Boolean(busy)} onClick={save} className={secondary}>
                        Save Sources
                    </button>
                    <span className="text-[11px] text-white/35">Saving starts nothing and keeps every stored result.</span>
                </div>
            </div>

            <div className="space-y-2 border-t border-white/10 pt-3">
                <label htmlFor="catalytic-scope" className="block text-[10px] font-bold uppercase tracking-wider text-white/40">Process</label>
                <select
                    id="catalytic-scope"
                    value={scope}
                    onChange={(e) => setScope(e.target.value)}
                    className="h-10 w-full rounded-xl border border-white/10 bg-[#0b0d12] px-3 text-base text-white/85 sm:w-auto sm:text-xs"
                >
                    {scopes.map((s) => <option key={s.id} value={s.id}>{s.label} ({s.count})</option>)}
                </select>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        disabled={!localSelected || dirty || !affected || Boolean(busy)}
                        onClick={runLocal}
                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-500 px-4 text-xs font-bold text-black disabled:opacity-40"
                    >
                        {busy === "local" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        Run Local Search ({affected})
                    </button>
                </div>
                {!localSelected && <p className="text-[11px] text-white/35">Select a local database and save to run a local search.</p>}
            </div>

            <div className="space-y-2 border-t border-white/10 pt-3">
                {overview.paid_block_reason && (
                    <p role="status" className="flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-3 text-xs text-amber-200">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span>
                            {overview.paid_block_reason}{" "}
                            <Link href="/cats/admin/catdb" className="underline">Open CatDB administration</Link>
                        </span>
                    </p>
                )}
                <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={overview.global_paused || Boolean(busy)} onClick={() => setPending("pause")} className={secondary}>
                        {overview.global_paused ? "Paused" : "Pause"}
                    </button>
                    <button type="button" disabled={stoppable.length === 0 || Boolean(busy)} onClick={() => setPending("stop")} className={secondary}>
                        {overview.workers.length > 0 && stoppable.length === 0 ? "Stopped" : "Stop"}
                    </button>
                    <button
                        type="button"
                        disabled={overview.active_job_count === 0 || Boolean(busy)}
                        onClick={() => setPending("cancel")}
                        className="h-10 rounded-xl border border-rose-500/40 px-3 text-xs font-bold text-rose-300 disabled:opacity-40"
                    >
                        Cancel Remaining ({overview.active_job_count})
                    </button>
                </div>
                <p className="text-[11px] text-white/35">Pause and Stop apply to CatDB as a whole, because all batches share its devices. Cancel Remaining applies to this batch.</p>
            </div>

            {saved.CATDB_VIN && !dirty ? (
                <CatdbSection
                    batchId={batchId}
                    refreshKey={refreshKey}
                    onBatchDataChanged={onChanged}
                    scope={scope}
                    scopeCount={paidScopeCount}
                    vehicleIds={scope === "SELECTED" ? selectedVehicleIds : undefined}
                    blockReason={overview.paid_block_reason}
                />
            ) : (
                <p className="border-t border-white/10 pt-3 text-[11px] text-white/35">Select CatDB VIN Search and save to preview paid searches.</p>
            )}

            {pending && <ConfirmDialog action={ACTIONS[pending]} busy={Boolean(busy)} onConfirm={confirmAction} onClose={() => setPending(null)} />}
        </section>
    );
}
