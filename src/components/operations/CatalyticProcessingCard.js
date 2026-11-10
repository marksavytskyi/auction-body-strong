"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import Link from "next/link";
import { AlertTriangle, Database, Loader2, Search } from "lucide-react";

import {
    approveOperationsCatdbSearches,
    cancelOperationsCatalyticRemaining,
    getOperationsCatalytic,
    planOperationsCatalytic,
    previewOperationsCatdbSearches,
    runOperationsCatalyticAnalysis,
    saveOperationsCatalyticSources,
} from "@/lib/operations/api";
import { CatalyticApiError } from "@/lib/catalytic/http";
import { isPageHidden } from "@/lib/pageVisibility";
import { CATALYTIC_SOURCE_LABEL, CATALYTIC_STATUS_LABEL, CATALYTIC_STATUS_TONE } from "@/lib/operations/constants";
import StatusPill from "@/components/catalytic/StatusPill";
import { ConfirmDialog } from "@/components/catalytic/CatdbProcessingControls";
import InfoTip from "@/components/ui/InfoTip";
import CollapsibleSection from "./CollapsibleSection";
import CatdbApprovalHistory from "./CatdbApprovalHistory";
import PaidRunDialog, { paidExclusions } from "./PaidRunDialog";

// Phase K.52 — one place to search for catalytic prices, with one Run button.
//
// Free sources (Our Database, CatDB Local, EcoTrade Local) run straight away, exactly as
// K.49's Run Catalytic Analysis did. CatDB VIN is paid: when it is ticked, Run first reads
// a fresh preview (spends nothing) and asks once. Approving sends that preview's
// fingerprint and the exact number shown to the existing approval, which does everything
// K.51 hardened: subscription pinning, quota reservation, never searching a VIN twice.
// The free lookups then run. Neither part undoes the other.
//
// Which stored price counts toward Recovery Total is not chosen here: that is Recovery
// Settings' price priority.

const POLL_MS = 15_000;
const OUR_DATABASE_POLL_MS = 5_000;

const ORDER = ["OUR_DATABASE", "CATDB_LOCAL", "ECOTRADE_LOCAL", "CATDB_VIN"];
const FREE_SOURCES = ["OUR_DATABASE", "CATDB_LOCAL", "ECOTRADE_LOCAL"];
const SHORT_LABEL = { OUR_DATABASE: "Our Database", CATDB_VIN: "CatDB VIN", CATDB_LOCAL: "CatDB Local", ECOTRADE_LOCAL: "EcoTrade Local" };
const SOURCE_HINT = {
    OUR_DATABASE: "Our own recorded sales",
    CATDB_LOCAL: "CatDB data already stored: an earlier VIN search, or the catalog",
    ECOTRADE_LOCAL: "The stored EcoTrade catalog",
    CATDB_VIN: "A new search on the Android device, for this VIN",
};
const SOURCE_FIELD = { OUR_DATABASE: "run_ourdb", CATDB_VIN: "run_catdb", CATDB_LOCAL: "run_catdb_local", ECOTRADE_LOCAL: "run_ecotrade_local" };
const RUNNING = ["PROCESSING", "RUNNING", "QUEUED"];
const UNTOUCHED = ["NOT_REQUESTED", "READY", "NOT_STARTED"];
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : /(s|ch|sh|x)$/.test(word) ? "es" : "s"}`;

// What one free source of the last run did, never claiming a lookup that didn't happen.
function runLine(result) {
    const name = SHORT_LABEL[result.source];
    if (result.state === "ALREADY_RUNNING") return `${name}: already running for this batch, nothing new started`;
    if (result.state === "NOTHING_TO_DO") return `${name}: nothing to look up`;
    if (result.state === "STARTED") return `${name}: looking up ${plural(result.vehicles, "vehicle")} in the background`;
    const kept = result.kept_existing ? ` · ${result.kept_existing} kept their stored price` : "";
    return `${name}: looked up ${plural(result.vehicles, "vehicle")} · ${result.matched} matched · ${result.no_match} no match · ${result.failed} failed${kept}`;
}

// The collapsed header: real state only.
export function catalyticHeadline(overview) {
    if (!overview) return { summary: null, status: null };
    const sources = overview.sources;
    const vin = sources.find((s) => s.source === "CATDB_VIN");
    const priced = sources.filter((s) => s.priced > 0).map((s) => `${SHORT_LABEL[s.source]} ${s.priced}`);
    const summary = [
        priced.length ? `Priced: ${priced.join(" · ")}` : null,
        overview.active_job_count ? `${plural(overview.active_job_count, "paid search")} waiting or running${overview.global_paused ? " (CatDB paused)" : ""}` : null,
    ].filter(Boolean).join(" · ") || null;
    let status;
    if (overview.active_job_count || sources.some((s) => RUNNING.includes(s.status))) status = { label: "Running", tone: "progress" };
    else if (sources.some((s) => s.status === "FAILED")) status = { label: "Failed", tone: "danger" };
    else if (vin?.status === "REVIEW_REQUIRED") status = { label: "Requires Review", tone: "warning" };
    else if (sources.every((s) => UNTOUCHED.includes(s.status))) status = { label: "Not Started", tone: "neutral" };
    else if (sources.filter((s) => s.selected).every((s) => ["COMPLETED", "COMPLETE", "NO_MATCH"].includes(s.status))) status = { label: "Completed", tone: "success" };
    else status = { label: "Partial", tone: "warning" };
    return { summary, status };
}

// What a CatDB VIN preview found with nothing new to search.
function noPaidWork(preview) {
    const reasons = paidExclusions(preview).map(([reason, count]) => `${count} ${reason}`);
    return `CatDB VIN: nothing new to search${reasons.length ? ` (${reasons.join("; ")})` : ""}. Nothing paid was queued.`;
}

export default function CatalyticProcessingCard({ batchId, refreshKey, selectedVehicleIds = [], onChanged }) {
    const [overview, setOverview] = useState(null);
    const [draft, setDraft] = useState(null);
    const [scope, setScope] = useState("ALL");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState("");
    const [plan, setPlan] = useState(null);
    const [planError, setPlanError] = useState("");
    const [lastRun, setLastRun] = useState(null);
    const [paidPreview, setPaidPreview] = useState(null);
    const [confirmCancel, setConfirmCancel] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
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

    // Only while this batch has paid jobs out, so a settled batch makes no requests.
    const activeJobs = overview?.active_job_count ?? 0;
    useEffect(() => {
        if (!activeJobs) return undefined;
        const timer = setInterval(() => { if (!isPageHidden()) onChanged?.(); }, POLL_MS);
        return () => clearInterval(timer);
    }, [activeJobs, onChanged]);

    // Our Database runs in the background on the server, so follow it until it settles.
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
    const ticked = draft ? ORDER.filter((source) => draft[source]) : [];
    const planKey = JSON.stringify([ticked, scope, scope === "SELECTED" ? selectedVehicleIds : null, refreshKey, overview?.sources?.map((s) => s.status)]);

    // The server counts what the free sources would look up, for the ticked sources and scope.
    useEffect(() => {
        if (!draft) return undefined;
        if (scope === "SELECTED" && selectedVehicleIds.length === 0) {
            setPlan({ vehicles_in_scope: 0, vehicles_to_process: 0, sources: [], blocked_reason: "Select vehicles in the table first." });
            return undefined;
        }
        if (!tickedFree.length) {
            setPlan({ vehicles_in_scope: null, vehicles_to_process: 0, sources: [], blocked_reason: null });
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

    const { summary, status } = catalyticHeadline(overview);

    if (!overview || !draft) {
        return (
            <CollapsibleSection title="Catalytic Processing" icon={Database} label="Catalytic processing" summary={error ? null : "Loading…"}
                status={error ? { label: "Couldn't load", tone: "danger" } : null}>
                {error ? (
                    <span className="flex items-center justify-between gap-3 text-sm text-rose-300">
                        {error}
                        <button type="button" onClick={load} className="underline">Retry</button>
                    </span>
                ) : <span className="text-sm text-white/50">Loading catalytic processing…</span>}
            </CollapsibleSection>
        );
    }

    const saved = Object.fromEntries(overview.sources.map((s) => [s.source, s.selected]));
    const counts = overview.scope_counts;
    const scopes = [
        { id: "ALL", label: `All vehicles (${counts.ALL})` },
        { id: "SELECTED", label: `Selected vehicles (${selectedVehicleIds.length})` },
        { id: "MISSING", label: "Missing results" },
        { id: "FAILED", label: "Failed lookups" },
    ];
    // Paid searches only ever go to never-searched VINs, so "Missing results" is the whole batch for them.
    const paidScope = scope === "MISSING" ? "ALL" : scope;
    const vehicleIds = scope === "SELECTED" ? selectedVehicleIds : undefined;
    const paidTicked = Boolean(draft.CATDB_VIN);
    const paidBlocked = paidTicked ? overview.paid_block_reason : null;
    const freeToProcess = plan?.vehicles_to_process ?? 0;
    const scopeEmpty = scope === "SELECTED" && selectedVehicleIds.length === 0;
    const freeBlocked = tickedFree.length ? plan?.blocked_reason : null;
    // K.52 final: while CatDB is paused (or every device is stopped) the backend refuses paid
    // approvals. The selection is kept, the row says so, and Run says it runs free sources only.
    const paidState = overview.global_paused ? "PAUSED" : overview.paid_block_reason ? "UNAVAILABLE" : null;
    const freeNames = tickedFree.map((source) => SHORT_LABEL[source]).join(", ");
    const freeOnlyRun = paidTicked && Boolean(paidBlocked) && tickedFree.length > 0;
    const canRun = !busy && !scopeEmpty && Boolean(plan) && (freeToProcess > 0 || (paidTicked && !paidBlocked));
    const sourcesBody = Object.fromEntries(ORDER.map((source) => [SOURCE_FIELD[source], Boolean(draft[source])]));
    const freeSummary = tickedFree.length
        ? (freeToProcess > 0 ? `Free sources look up ${plural(freeToProcess, "vehicle")} at no cost.` : `Free sources: ${freeBlocked || "nothing to look up"}`)
        : null;

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
        }
    };

    // Runs what was decided: an approved paid preview (or none), then the free sources.
    const execute = ({ preview, paidNote }) => perform("run", async () => {
        const outcome = { free: null, freeError: null, freeNote: null, paid: paidNote || null };
        if (preview) {
            try {
                // An approval needs CatDB VIN saved as a source; saving starts nothing.
                if (!saved.CATDB_VIN) await saveOperationsCatalyticSources(batchId, sourcesBody);
                const approval = await approveOperationsCatdbSearches(batchId, {
                    previewFingerprint: preview.fingerprint,
                    maxNewSearches: preview.max_approvable_new_searches,
                    confirm: true,
                    scope: paidScope,
                    vehicleIds,
                });
                outcome.paid = {
                    ok: true,
                    text: `CatDB VIN: ${plural(approval.new_search_count, "paid search")} queued${overview.global_paused ? ". CatDB is paused, so they wait until it is resumed" : ""}.`,
                };
            } catch (e) {
                const message = e instanceof CatalyticApiError ? e.message : "the approval failed";
                outcome.paid = {
                    ok: false,
                    text: e instanceof CatalyticApiError && e.status === 409
                        ? "CatDB VIN: the batch changed since the count, so nothing paid was queued. Press Run again for a fresh count."
                        : `CatDB VIN didn't start: ${message}. Nothing paid was queued.`,
                };
            }
        }
        if (tickedFree.length && freeToProcess > 0) {
            try {
                outcome.free = await runOperationsCatalyticAnalysis(batchId, { sources: ticked, scope, vehicleIds });
            } catch (e) {
                outcome.freeError = e instanceof CatalyticApiError ? e.message : "The free lookups failed";
            }
        } else {
            if (tickedFree.length) outcome.freeNote = `Free sources: ${freeBlocked || "nothing to look up"}`;
            // Nothing free ran, so save the ticked sources the way a run would have.
            if (!preview && ORDER.some((source) => Boolean(draft[source]) !== Boolean(saved[source]))) {
                await saveOperationsCatalyticSources(batchId, sourcesBody);
            }
        }
        setLastRun(outcome);
        const failed = outcome.freeError || (outcome.paid && outcome.paid.ok === false);
        if (outcome.paid?.blocked && !outcome.freeError) toast.error(`${paidState === "PAUSED" ? "CatDB is paused" : "CatDB VIN is unavailable"}: only the free sources ran.`);
        else if (failed) toast.error("Part of the analysis didn't start. See Last run.");
        else toast.success("Catalytic analysis started. See Last run.");
    });

    const run = async () => {
        if (running.current || !canRun) return;
        if (!paidTicked) return execute({});
        if (paidBlocked) {
            return execute({
                paidNote: {
                    ok: false,
                    blocked: true,
                    text: `CatDB VIN didn't run: ${paidState === "PAUSED" ? "CatDB is paused" : paidBlocked}. Only ${freeNames} ran; no paid search or reservation was created. CatDB VIN stays selected.`,
                },
            });
        }
        setBusy("preview");
        let preview = null;
        let paidNote = null;
        try {
            preview = await previewOperationsCatdbSearches(batchId, { scope: paidScope, vehicleIds });
        } catch (e) {
            paidNote = { ok: false, text: `CatDB VIN couldn't be counted: ${e instanceof CatalyticApiError ? e.message : "preview failed"}. Nothing paid was queued.` };
        } finally {
            setBusy("");
        }
        if (preview && preview.max_approvable_new_searches > 0) {
            setPaidPreview(preview);
            return undefined;
        }
        if (preview) paidNote = { ok: true, text: noPaidWork(preview) };
        if (!tickedFree.length || freeToProcess === 0) {
            setLastRun({ paid: paidNote, freeNote: tickedFree.length ? `Free sources: ${freeBlocked || "nothing to look up"}` : null });
            return undefined;
        }
        return execute({ paidNote });
    };

    const approvePaid = () => {
        const preview = paidPreview;
        setPaidPreview(null); // one approval per preview, never reused
        execute({ preview });
    };
    const freeOnly = () => {
        setPaidPreview(null);
        execute({ paidNote: { ok: true, text: "CatDB VIN: skipped this time. Nothing paid was queued." } });
    };

    const vin = overview.sources.find((s) => s.source === "CATDB_VIN");
    const vinCounts = vin?.counts || {};
    const vinLine = [
        ["QUEUED", "waiting"], ["PROCESSING", "running"], ["DONE", "searched"], ["REVIEW_REQUIRED", "require review"],
        ["NO_RESULT", "no result"], ["FAILED", "failed"],
    ].filter(([key]) => vinCounts[key]).map(([key, word]) => `${vinCounts[key]} ${word}`);
    const showPaidStatus = paidTicked || saved.CATDB_VIN || overview.active_job_count > 0 || vinLine.length > 0;

    return (
        <CollapsibleSection title="Catalytic Processing" icon={Database} label="Catalytic processing" summary={summary} status={status}>
            <div className="space-y-2">
                <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-white/40">
                    Search sources
                    <InfoTip label="About search sources">
                        Which databases Run looks up. Results from every source are kept side by side. Which one counts toward Recovery Total is set in Recovery Settings → Catalytic price priority.
                    </InfoTip>
                </div>
                {ORDER.map((key) => {
                    const source = overview.sources.find((s) => s.source === key);
                    if (!source) return null;
                    const paid = key === "CATDB_VIN";
                    return (
                        <div key={key} className="flex flex-wrap items-center justify-between gap-2">
                            <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2.5 text-xs text-white/85">
                                <input
                                    type="checkbox"
                                    checked={Boolean(draft[key])}
                                    disabled={Boolean(busy)}
                                    onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.checked }))}
                                    className="mt-0.5 h-4 w-4 shrink-0"
                                />
                                <span className="min-w-0">
                                    <span className="font-bold">{CATALYTIC_SOURCE_LABEL[key]}</span>
                                    <span className={`ml-2 rounded px-1.5 py-0.5 text-[9px] font-black tracking-wider ${paid ? "bg-amber-400/15 text-amber-200" : "bg-emerald-400/10 text-emerald-300"}`}>{paid ? "PAID" : "FREE"}</span>
                                    {paid && paidState && (
                                        <span data-testid="catdb-vin-paused" className="ml-1.5 rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-black tracking-wider text-amber-100">
                                            {paidState === "PAUSED" ? "PAUSED" : "UNAVAILABLE"}
                                        </span>
                                    )}
                                    <span className="block text-[11px] text-white/40">{SOURCE_HINT[key]}</span>
                                    {paid && paidState && (
                                        <span className="block text-[11px] text-amber-200/90">
                                            {paidState === "PAUSED"
                                                ? "Paid searches can't start while CatDB is paused. Resume it in CATS → CatDB Automation."
                                                : `Paid searches can't start now: ${paidBlocked || overview.paid_block_reason}`}
                                        </span>
                                    )}
                                </span>
                            </label>
                            <span className="flex items-center gap-2">
                                {source.priced > 0 && <span className="text-[11px] text-white/45">{source.priced} priced</span>}
                                <StatusPill label={CATALYTIC_STATUS_LABEL[source.status] || source.status} tone={CATALYTIC_STATUS_TONE[source.status] || "neutral"} />
                            </span>
                        </div>
                    );
                })}
            </div>

            <div className="space-y-2 border-t border-white/10 pt-3">
                <label htmlFor="catalytic-scope" className="block text-[10px] font-bold uppercase tracking-wider text-white/40">Scope</label>
                <select
                    id="catalytic-scope"
                    value={scope}
                    disabled={Boolean(busy)}
                    onChange={(e) => setScope(e.target.value)}
                    className="h-10 w-full rounded-xl border border-white/10 bg-[#0b0d12] px-3 text-base text-white/85 sm:w-auto sm:text-xs"
                >
                    {scopes.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>

                <div aria-label="What will be looked up" className="space-y-0.5 text-[11px] text-white/55">
                    {tickedFree.length > 0 && plan && !scopeEmpty && (
                        <div>{freeToProcess > 0 ? <b className="text-white/80">{plural(freeToProcess, "vehicle")} to look up in free sources</b> : freeBlocked}</div>
                    )}
                    {paidTicked && !paidBlocked && <div className="text-amber-200/80">CatDB VIN is paid: Run counts the VINs it can search and asks you once before anything paid starts.</div>}
                    {paidBlocked && (
                        <div role="status" aria-label="CatDB VIN paused" className="flex items-start gap-1.5 text-amber-200">
                            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                            <span>
                                {paidState === "PAUSED" ? "CatDB is paused, so CatDB VIN can't run. " : `CatDB VIN can't run now: ${paidBlocked} `}
                                {tickedFree.length
                                    ? <>Run will look up only {freeNames}. CatDB VIN stays selected; no paid search or reservation is created. </>
                                    : <>No free source is ticked, so nothing can run. </>}
                                <Link href="/cats/admin/catdb" className="underline">CatDB Automation</Link>
                            </span>
                        </div>
                    )}
                    {!ticked.length && <div>Tick at least one source.</div>}
                    {scopeEmpty && <div>Select vehicles in the table first.</div>}
                    {planError && <div className="text-rose-300">{planError}</div>}
                </div>

                <button
                    type="button"
                    disabled={!canRun}
                    onClick={run}
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-500 px-4 text-xs font-bold text-black disabled:opacity-40"
                >
                    {busy === "run" || busy === "preview" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    Run Catalytic Analysis{freeOnlyRun ? " (free sources only)" : ""}
                </button>

                {lastRun && (
                    <div role="status" aria-label="Last catalytic analysis" className="space-y-0.5 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-[11px] text-white/70">
                        <div className="font-bold text-white/85">Last run</div>
                        {lastRun.free?.sources.map((r) => <div key={r.source}>{runLine(r)}</div>)}
                        {lastRun.freeError && <div className="text-rose-300">Free sources didn&apos;t run: {lastRun.freeError}</div>}
                        {lastRun.freeNote && <div>{lastRun.freeNote}</div>}
                        {lastRun.paid && <div className={lastRun.paid.ok ? "text-white/70" : "text-amber-200"}>{lastRun.paid.text}</div>}
                    </div>
                )}
            </div>

            {showPaidStatus && (
                <div className="space-y-2 border-t border-white/10 pt-3 text-[11px] text-white/60">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        <span>
                            <b className="text-white/80">CatDB VIN</b>: {vinLine.length ? vinLine.join(" · ") : "no paid searches yet"}
                            {overview.active_job_count > 0 && overview.global_paused && <span className="text-amber-200"> · CatDB is paused</span>}
                        </span>
                        {overview.active_job_count > 0 && (
                            <button type="button" disabled={Boolean(busy)} onClick={() => setConfirmCancel(true)}
                                className="h-9 rounded-xl border border-rose-500/40 px-3 text-xs font-bold text-rose-300 disabled:opacity-40">
                                Cancel remaining ({overview.active_job_count})
                            </button>
                        )}
                        <button type="button" onClick={() => setShowHistory((v) => !v)} aria-expanded={showHistory} className="underline">
                            {showHistory ? "Hide paid search history" : "Paid search history"}
                        </button>
                        <Link href="/cats/admin/catdb" className="underline">CatDB Automation</Link>
                    </div>
                    {showHistory && <CatdbApprovalHistory batchId={batchId} refreshKey={refreshKey} />}
                </div>
            )}

            {paidPreview && (
                <PaidRunDialog
                    preview={paidPreview}
                    freeSummary={freeSummary}
                    paused={overview.global_paused}
                    busy={busy === "run"}
                    onApprove={approvePaid}
                    onFreeOnly={tickedFree.length && freeToProcess > 0 ? freeOnly : null}
                    onClose={() => setPaidPreview(null)}
                />
            )}
            {confirmCancel && (
                <ConfirmDialog
                    action={{
                        title: "Cancel this batch's remaining paid searches?",
                        body: "Cancels this batch's CatDB jobs that haven't submitted a search. Other batches and CatDB itself aren't affected. Completed results are kept, used quota isn't refunded, and a search already submitted isn't retried.",
                        confirm: "Cancel remaining",
                    }}
                    busy={busy === "cancel"}
                    onConfirm={() => perform("cancel", async () => {
                        const result = await cancelOperationsCatalyticRemaining(batchId);
                        const inFlight = result.search_already_submitted_job_ids.length;
                        toast.success(`${result.cancelled_job_ids.length} cancelled${inFlight ? `; ${inFlight} already submitted and can't be stopped` : ""}`);
                        setConfirmCancel(false);
                    })}
                    onClose={() => setConfirmCancel(false)}
                />
            )}
        </CollapsibleSection>
    );
}
