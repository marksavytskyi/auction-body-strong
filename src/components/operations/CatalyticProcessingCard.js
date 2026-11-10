"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import Link from "next/link";
import { AlertTriangle, Database, Loader2, Search } from "lucide-react";

import {
    cancelOperationsCatalyticRemaining,
    getOperationsCatalytic,
    planOperationsCatalytic,
    runOperationsCatalyticAnalysis,
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
const OUR_DATABASE_POLL_MS = 5_000;

const SOURCE_HINT = {
    OUR_DATABASE: "Free lookup in our own sales records. No Android Worker, no CatDB quota",
    CATDB_VIN: "Paid VIN lookup using Android Worker. Not part of Run Catalytic Analysis: it has its own approval below",
    CATDB_LOCAL: "Search previously stored CatDB data",
    ECOTRADE_LOCAL: "Search previously stored EcoTrade data",
};

// Run Catalytic Analysis looks these up. CatDB VIN Search is paid and never runs from it.
const FREE_SOURCES = ["OUR_DATABASE", "CATDB_LOCAL", "ECOTRADE_LOCAL"];
const SHORT_LABEL = { OUR_DATABASE: "Our Database", CATDB_VIN: "CatDB VIN", CATDB_LOCAL: "CatDB Local", ECOTRADE_LOCAL: "EcoTrade Local" };
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// What one source of the last run did, in words that never claim a lookup that didn't happen.
function runLine(result) {
    const name = SHORT_LABEL[result.source];
    if (result.state === "ALREADY_RUNNING") return `${name}: already running for this batch, nothing new started`;
    if (result.state === "NOTHING_TO_DO") return `${name}: nothing to look up`;
    if (result.state === "STARTED") return `${name}: looking up ${plural(result.vehicles, "vehicle")} in the background`;
    const kept = result.kept_existing ? ` · ${result.kept_existing} kept their stored price` : "";
    return `${name}: looked up ${plural(result.vehicles, "vehicle")} · ${result.matched} matched · ${result.no_match} no match · ${result.failed} failed${kept}`;
}

const SOURCE_FIELD = { OUR_DATABASE: "run_ourdb", CATDB_VIN: "run_catdb", CATDB_LOCAL: "run_catdb_local", ECOTRADE_LOCAL: "run_ecotrade_local" };

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
    const [plan, setPlan] = useState(null);
    const [planError, setPlanError] = useState("");
    const [lastRun, setLastRun] = useState(null);
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

    // Runs in the background on the server, so follow it until it settles.
    const ourDatabaseRunning = overview?.sources.find((s) => s.source === "OUR_DATABASE")?.status === "PROCESSING";
    useEffect(() => {
        if (!ourDatabaseRunning) return undefined;
        const timer = setInterval(() => {
            if (isPageHidden()) return;
            if (onChanged) onChanged();
            else load();
        }, OUR_DATABASE_POLL_MS);
        return () => clearInterval(timer);
    }, [ourDatabaseRunning, onChanged, load]);

    const tickedFree = draft ? FREE_SOURCES.filter((source) => draft[source]) : [];
    const ticked = draft ? Object.keys(draft).filter((source) => draft[source]) : [];
    const planKey = JSON.stringify([ticked.sort(), scope, scope === "SELECTED" ? selectedVehicleIds : null, refreshKey, overview?.sources?.map((s) => s.status)]);

    // The server counts exactly what a run would look up, for the ticked sources and scope.
    useEffect(() => {
        if (!draft) return undefined;
        if (scope === "SELECTED" && selectedVehicleIds.length === 0) {
            setPlan({ vehicles_in_scope: 0, vehicles_to_process: 0, sources: [], paid: null, blocked_reason: "Select vehicles in the table first." });
            return undefined;
        }
        let current = true;
        const timer = setTimeout(() => {
            planOperationsCatalytic(batchId, { sources: ticked, scope, vehicleIds: scope === "SELECTED" ? selectedVehicleIds : undefined })
                .then((data) => { if (current) { setPlan(data); setPlanError(""); } })
                .catch((e) => { if (current) { setPlan(null); setPlanError(e instanceof CatalyticApiError ? e.message : "Failed to count the vehicles to process"); } });
        }, 250);
        return () => { current = false; clearTimeout(timer); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [batchId, planKey]);

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
    const counts = overview.scope_counts;
    const scopes = [
        { id: "ALL", label: `All vehicles (${counts.ALL})` },
        { id: "SELECTED", label: `Selected vehicles (${selectedVehicleIds.length})` },
        { id: "MISSING", label: "Missing results" },
        { id: "FAILED", label: "Failed lookups" },
    ];
    // The paid preview has its own classification: it only ever searches never-searched VINs.
    const paidScope = scope === "MISSING" ? "ALL" : scope;
    const paidScopeCount = { ALL: counts.ALL, SELECTED: selectedVehicleIds.length, FAILED: counts.PAID_FAILED }[paidScope] ?? 0;
    const stoppable = overview.workers.filter((w) => w.stop_state === "NONE");
    const ourDatabase = overview.sources.find((s) => s.source === "OUR_DATABASE");
    const toProcess = plan?.vehicles_to_process ?? 0;
    const blockedReason = !tickedFree.length
        ? (draft.CATDB_VIN ? "CatDB VIN Search is paid and runs only through its own approval below. Tick Our Database, CatDB Local or EcoTrade Local to run an analysis." : "Tick at least one source.")
        : plan?.blocked_reason;
    const canRun = Boolean(plan) && toProcess > 0 && !blockedReason && !busy;

    const save = () => perform("save", async () => {
        await saveOperationsCatalyticSources(
            batchId,
            Object.fromEntries(overview.sources.map((s) => [SOURCE_FIELD[s.source], Boolean(draft[s.source])])),
        );
        toast.success("Sources saved");
    });

    const runAnalysis = () => perform("run", async () => {
        const result = await runOperationsCatalyticAnalysis(batchId, {
            sources: ticked, scope, vehicleIds: scope === "SELECTED" ? selectedVehicleIds : undefined,
        });
        setLastRun(result);
        const lookedUp = result.sources.some((s) => s.state === "COMPLETED" || s.state === "STARTED");
        if (lookedUp) toast.success("Catalytic analysis ran. Results are below and in the table.");
        else toast.error("Nothing was looked up: every source had nothing to do.");
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
                        <span className="flex items-center gap-2">
                            {source.priced > 0 && <span className="text-[11px] text-white/45">{source.priced} priced</span>}
                            <StatusPill label={CATALYTIC_STATUS_LABEL[source.status] || source.status} tone={CATALYTIC_STATUS_TONE[source.status] || "neutral"} />
                        </span>
                    </div>
                ))}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button type="button" disabled={!dirty || Boolean(busy)} onClick={save} className={secondary}>
                        Save Sources
                    </button>
                    <span className="text-[11px] text-white/35">Saving starts nothing and keeps every stored result. Running saves the ticked sources too.</span>
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
                    {scopes.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>

                {plan && tickedFree.length > 0 && (
                    <div aria-label="What will be looked up" className="space-y-0.5 text-[11px] text-white/55">
                        <div>
                            {plural(overview.total_vehicles, "vehicle")} in the batch · {plan.vehicles_in_scope} in this scope · <b className="text-white/80">{plan.vehicles_to_process} to look up</b>
                        </div>
                        {plan.sources.map((s) => (
                            <div key={s.source}>
                                {SHORT_LABEL[s.source]}: {s.to_process} to look up · {s.with_result} already looked up, {s.priced} priced
                                {s.in_progress > 0 && " · running now"}
                            </div>
                        ))}
                    </div>
                )}
                {planError && <p className="text-[11px] text-rose-300">{planError}</p>}

                <button
                    type="button"
                    disabled={!canRun}
                    onClick={runAnalysis}
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-500 px-4 text-xs font-bold text-black disabled:opacity-40"
                >
                    {busy === "run" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    Run Catalytic Analysis ({plural(toProcess, "vehicle")})
                </button>
                {blockedReason && <p role="note" className="text-[11px] text-white/45">{blockedReason}</p>}
                {draft.CATDB_VIN && tickedFree.length > 0 && (
                    <p className="text-[11px] text-amber-200/80">
                        CatDB VIN Search is paid, so this run doesn&apos;t include it{overview.paid_block_reason ? `: ${overview.paid_block_reason}` : ". Approve paid searches separately below."}
                    </p>
                )}
                <p className="text-[11px] text-white/35">
                    Looks up catalytic converters only: no Parts, Weight, Scrap or Recovery Rules. The ticked sources are saved, a stored price is never replaced by an empty result, and whether a result counts toward Recovery Total is decided in Recovery Settings.
                </p>

                {lastRun && (
                    <div role="status" aria-label="Last catalytic analysis" className="space-y-0.5 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-[11px] text-white/70">
                        <div className="font-bold text-white/85">Last run · {plural(lastRun.vehicles_to_process, "vehicle")} to look up</div>
                        {lastRun.sources.map((r) => <div key={r.source}>{runLine(r)}</div>)}
                        {lastRun.sources.some((r) => r.source === "OUR_DATABASE" && r.state === "STARTED") && ourDatabase && (
                            <div>
                                Our Database {ourDatabaseRunning ? "is running" : "has finished"}: {ourDatabase.priced} priced in this batch
                                {" · "}{ourDatabase.counts.FAILED || 0} failed
                                {ourDatabaseRunning && <> · {(ourDatabase.counts.QUEUED || 0) + (ourDatabase.counts.NOT_REQUESTED || 0)} still to look up</>}
                            </div>
                        )}
                    </div>
                )}
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
                    scope={paidScope}
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
