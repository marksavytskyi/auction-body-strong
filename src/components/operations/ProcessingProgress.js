"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, AlertTriangle, Activity } from "lucide-react";

import { getOperationsBatchProgress, getOperationsCatalytic } from "@/lib/operations/api";
import { CatalyticApiError } from "@/lib/catalytic/http";
import StatusPill from "@/components/catalytic/StatusPill";
import CollapsibleSection from "./CollapsibleSection";

// Phase K.53 — every processing service on its own row: Parts, Weight, and each catalytic
// source. Every number comes from the backend's stored statuses (the progress endpoint and
// the catalytic overview); nothing is inferred from prices or from ticked boxes.

const sum = (counts, keys) => keys.reduce((n, k) => n + (counts?.[k] || 0), 0);

// The per-status counts of one service, normalised: total, finished, failed, review, running, queued, untouched.
function legCounts(leg) {
    return {
        total: leg?.total || 0,
        completed: (leg?.done_count || 0) + (leg?.no_data_count || 0),
        failed: leg?.failed_count || 0,
        review: 0,
        running: leg?.processing_count || 0,
        queued: leg?.queued_count || 0,
        untouched: leg?.not_requested_count || 0,
    };
}

function sourceCounts(source, total, overrides = {}) {
    const c = source?.counts || {};
    if (source?.source === "CATDB_VIN") {
        return {
            total,
            completed: sum(c, ["DONE", "NO_RESULT", "SKIPPED_INELIGIBLE"]),
            failed: c.FAILED || 0,
            review: c.REVIEW_REQUIRED || 0,
            running: c.PROCESSING || 0,
            queued: c.QUEUED || 0,
            untouched: c.NOT_REQUESTED || 0,
            ...overrides,
        };
    }
    return {
        total,
        completed: sum(c, ["COMPLETED", "NO_MATCH"]),
        failed: c.FAILED || 0,
        review: 0,
        running: 0,
        queued: 0,
        untouched: c.NOT_REQUESTED || 0,
        ...overrides,
    };
}

// What one row says, from its counts. CatDB VIN's waiting reason comes from the backend.
function rowState(counts, { selected, queue } = {}) {
    if (counts.running > 0) return { label: "Running", tone: "progress" };
    if (counts.queued > 0) {
        const states = queue?.states || {};
        if (states.STALE) return { label: "Device stopped reporting", tone: "danger" };
        if (states.PAUSED) return { label: "Paused", tone: "warning" };
        if (states.WAITING_FOR_DEVICE) return { label: "Waiting for device", tone: "warning" };
        return { label: "Queued", tone: "info" };
    }
    if (counts.total > 0 && counts.untouched === counts.total) {
        return selected ? { label: "Selected, not run yet", tone: "neutral" } : { label: "Not requested", tone: "neutral" };
    }
    if (counts.review > 0) return { label: `${counts.review} require review`, tone: "warning" };
    if (counts.failed > 0) return { label: `${counts.failed} failed`, tone: "danger" };
    if (counts.completed + counts.untouched >= counts.total) return { label: "Completed", tone: "success" };
    return { label: "Partial", tone: "warning" };
}

export function serviceRows(progress, overview) {
    if (!progress) return [];
    const total = progress.total_vehicle_count ?? progress.parts?.total ?? 0;
    const bySource = Object.fromEntries((overview?.sources || []).map((s) => [s.source, s]));
    const ourdbRunning = bySource.OUR_DATABASE?.status === "PROCESSING";
    const ourdb = legCounts(progress.ourdb);
    if (ourdbRunning && ourdb.queued) { ourdb.running += ourdb.queued; ourdb.queued = 0; }
    const rows = [
        { key: "parts", name: "Parts Analysis", counts: legCounts(progress.parts) },
        { key: "weight", name: "Weight Analysis", counts: legCounts(progress.weight) },
        { key: "OUR_DATABASE", name: "Our Database", counts: ourdb, selected: bySource.OUR_DATABASE?.selected },
    ];
    if (overview) {
        rows.push(
            { key: "CATDB_LOCAL", name: "CatDB Local", counts: sourceCounts(bySource.CATDB_LOCAL, total), selected: bySource.CATDB_LOCAL?.selected },
            { key: "ECOTRADE_LOCAL", name: "EcoTrade Local", counts: sourceCounts(bySource.ECOTRADE_LOCAL, total), selected: bySource.ECOTRADE_LOCAL?.selected },
            { key: "CATDB_VIN", name: "CatDB VIN", counts: sourceCounts(bySource.CATDB_VIN, total), selected: bySource.CATDB_VIN?.selected, queue: overview.catdb_queue },
        );
    }
    return rows.map((row) => ({ ...row, state: rowState(row.counts, row) }));
}

// The collapsed header: running work, review and failures always visible.
export function progressHeadline(rows) {
    const active = rows.filter((r) => !["Not requested"].includes(r.state.label));
    if (!rows.length) return { summary: null, status: null };
    if (!active.length || active.every((r) => r.state.label === "Selected, not run yet")) {
        return { summary: null, status: { label: "Not Started", tone: "neutral" } };
    }
    const running = active.filter((r) => ["Running", "Queued", "Paused", "Waiting for device"].includes(r.state.label));
    const stale = active.filter((r) => r.state.label === "Device stopped reporting");
    const review = active.reduce((n, r) => n + r.counts.review, 0);
    const failed = active.reduce((n, r) => n + r.counts.failed, 0);
    const completed = active.filter((r) => r.state.label === "Completed").length;
    const parts = [
        `${completed} of ${active.length} services completed`,
        running.length ? `${running.length} ${running.length === 1 ? "is" : "are"} running or waiting (${running.map((r) => `${r.name}: ${r.state.label}`).join(", ")})` : null,
    ].filter(Boolean);
    let status;
    if (stale.length) status = { label: "Device stopped reporting", tone: "danger" };
    else if (failed) status = { label: `${failed} failed`, tone: "danger" };
    else if (review) status = { label: `${review} require review`, tone: "warning" };
    else if (running.length) status = { label: "Running", tone: "progress" };
    else if (completed === active.length) status = { label: "Completed", tone: "success" };
    else status = { label: "Partial", tone: "warning" };
    return { summary: parts.join(" · "), status };
}

function Row({ row }) {
    const { counts } = row;
    const untouched = counts.total > 0 && counts.untouched === counts.total;
    return (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl border border-white/10 bg-black/25 px-3 py-2" data-service={row.key}>
            <span className="text-xs font-bold text-white/80">{row.name}</span>
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                {!untouched && <span className="text-white/70">{counts.completed}/{counts.total} completed</span>}
                {counts.failed > 0 && <span className="text-rose-300">{counts.failed} failed</span>}
                {counts.review > 0 && <span className="text-amber-300">{counts.review} require review</span>}
                <StatusPill label={row.state.label} tone={row.state.tone} />
            </span>
            {row.queue?.text && counts.queued > 0 && <p className="w-full text-[11px] text-amber-200/80">{row.queue.text}</p>}
        </div>
    );
}

export default function ProcessingProgress({ batchId, refreshKey }) {
    const [progress, setProgress] = useState(null);
    const [overview, setOverview] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        try {
            const [data, catalytic] = await Promise.all([
                getOperationsBatchProgress(batchId),
                getOperationsCatalytic(batchId).catch(() => null),
            ]);
            setProgress(data);
            setOverview(catalytic);
            setError("");
        } catch (e) {
            setError(e instanceof CatalyticApiError ? e.message : "Failed to load processing progress");
        } finally {
            setLoading(false);
        }
    }, [batchId]);

    useEffect(() => { load(); }, [load, refreshKey]);

    const rows = serviceRows(progress, overview);
    const { summary, status } = progressHeadline(rows);
    return (
        <CollapsibleSection title="Processing Progress" icon={Activity} summary={loading ? "Loading…" : summary}
            status={error ? { label: "Couldn't load", tone: "danger" } : status}>
            {loading ? (
                <div className="flex items-center gap-2 text-white/50 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading processing progress…</div>
            ) : error ? (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2"><AlertTriangle className="h-4 w-4 shrink-0" /> {error}</span>
                    <button type="button" onClick={load} className="underline shrink-0">Retry</button>
                </div>
            ) : (
                <div className="space-y-1.5">
                    {rows.map((row) => <Row key={row.key} row={row} />)}
                    {!overview && <p className="text-[11px] text-white/35">Catalytic source progress couldn&apos;t be loaded.</p>}
                </div>
            )}
        </CollapsibleSection>
    );
}
