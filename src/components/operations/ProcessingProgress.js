"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, AlertTriangle, Activity } from "lucide-react";

import { getOperationsBatchProgress } from "@/lib/operations/api";
import { CatalyticApiError } from "@/lib/catalytic/http";
import { PROGRESS_FIELDS, PROGRESS_BUCKET_LABEL, PROGRESS_BUCKET_TONE, PROGRESS_LEG_LABEL } from "@/lib/operations/constants";
import { isLegActive } from "@/lib/operations/format";
import CollapsibleSection from "./CollapsibleSection";

const TONE_TEXT = {
    neutral: "text-white/60",
    info: "text-sky-300",
    progress: "text-violet-300",
    success: "text-emerald-300",
    danger: "text-rose-300",
    warning: "text-amber-300",
};
const LEGS = ["parts", "ourdb", "weight"];
const finished = (leg) => (leg?.done_count || 0) + (leg?.failed_count || 0) + (leg?.no_data_count || 0);

// Phase K.52 — the collapsed header, from the real per-leg counts. Running work and
// failures show here, so closing the section never hides them.
export function progressHeadline(progress) {
    if (!progress) return { summary: null, status: null };
    const active = LEGS.filter((key) => isLegActive(progress[key]));
    const failed = LEGS.reduce((n, key) => n + (progress[key]?.failed_count || 0), 0);
    if (active.length) {
        const done = active.reduce((n, key) => n + finished(progress[key]), 0);
        const total = active.reduce((n, key) => n + (progress[key]?.total || 0), 0);
        return {
            summary: `${active.map((key) => PROGRESS_LEG_LABEL[key]).join(", ")} running — ${done} / ${total} completed`,
            status: failed ? { label: `${failed} failed`, tone: "danger" } : { label: "Running", tone: "progress" },
        };
    }
    const started = LEGS.filter((key) => progress[key]?.total && progress[key].not_requested_count !== progress[key].total);
    if (!started.length) return { summary: null, status: { label: "Not Started", tone: "neutral" } };
    if (failed) return { summary: null, status: { label: `${failed} failed`, tone: "danger" } };
    return { summary: null, status: { label: "Completed", tone: "success" } };
}

// One line per analysis, showing only the counts that aren't zero.
function LegLine({ legKey, leg }) {
    const notStarted = !leg?.total || leg.not_requested_count === leg.total;
    return (
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-xl border border-white/10 bg-black/25 px-3 py-2">
            <span className="text-xs font-bold text-white/80">{PROGRESS_LEG_LABEL[legKey]}</span>
            {notStarted ? (
                <span className="text-xs text-white/40">Not started</span>
            ) : (
                <span className="flex flex-wrap gap-x-3 text-xs">
                    {PROGRESS_FIELDS[legKey].filter((field) => (leg[field] || 0) > 0).map((field) => (
                        <span key={field} className={TONE_TEXT[PROGRESS_BUCKET_TONE[field]] || "text-white/80"}>
                            {leg[field]} {PROGRESS_BUCKET_LABEL[field].toLowerCase()}
                        </span>
                    ))}
                    <span className="text-white/35">of {leg.total}</span>
                </span>
            )}
        </div>
    );
}

export default function ProcessingProgress({ batchId, refreshKey }) {
    const [progress, setProgress] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        try {
            const data = await getOperationsBatchProgress(batchId);
            setProgress(data);
            setError("");
        } catch (e) {
            setError(e instanceof CatalyticApiError ? e.message : "Failed to load processing progress");
        } finally {
            setLoading(false);
        }
    }, [batchId]);

    useEffect(() => { load(); }, [load, refreshKey]);

    const { summary, status } = progressHeadline(progress);
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
            ) : progress ? (
                <div className="space-y-1.5">
                    {LEGS.map((key) => <LegLine key={key} legKey={key} leg={progress[key]} />)}
                    <p className="text-[11px] text-white/35">CatDB Local, EcoTrade Local and CatDB VIN are in Catalytic Processing; device and job details are in CATS → CatDB Automation.</p>
                </div>
            ) : null}
        </CollapsibleSection>
    );
}
