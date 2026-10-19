"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, AlertTriangle, Activity } from "lucide-react";

import { getOperationsBatchProgress } from "@/lib/operations/api";
import { CatalyticApiError } from "@/lib/catalytic/http";
import { PROGRESS_FIELDS, PROGRESS_BUCKET_LABEL, PROGRESS_BUCKET_TONE, PROGRESS_LEG_LABEL } from "@/lib/operations/constants";

const TONE_TEXT = {
    neutral: "text-white/60",
    info: "text-sky-300",
    progress: "text-violet-300",
    success: "text-emerald-300",
    danger: "text-rose-300",
    warning: "text-amber-300",
};

// Real, backend-computed per-leg progress — replaces the old client-only
// "started"/"not started" guesswork entirely. Each leg only ever renders
// the buckets that make sense for it (PROGRESS_FIELDS): Parts/OurDB show
// their real NOT_REQUESTED/QUEUED/PROCESSING/DONE/FAILED status column;
// Weight has no discrete status column, so its last bucket is the
// terminal no_data_count (weight resolution finished without a usable
// result) rather than failed_count, which does not exist for that leg —
// see app.operations.schemas.LegProgressResponse's own docstring.
function LegSection({ legKey, leg }) {
    const fields = PROGRESS_FIELDS[legKey];
    return (
        <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
            <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] uppercase tracking-wider text-white/40 font-bold">{PROGRESS_LEG_LABEL[legKey]}</span>
                <span className="text-[11px] text-white/35">{leg.total} total</span>
            </div>
            <div className="grid grid-cols-5 gap-2">
                {fields.map((field) => (
                    <div key={field} className="text-center">
                        <div className={`text-lg font-black ${TONE_TEXT[PROGRESS_BUCKET_TONE[field]] || "text-white/90"}`}>
                            {leg[field] ?? 0}
                        </div>
                        <div className="text-[9px] uppercase tracking-wider text-white/40 font-bold mt-0.5">
                            {PROGRESS_BUCKET_LABEL[field]}
                        </div>
                    </div>
                ))}
            </div>
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

    if (loading) {
        return (
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4 flex items-center gap-2 text-white/50 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading processing progress…
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2"><AlertTriangle className="h-4 w-4 shrink-0" /> {error}</span>
                <button type="button" onClick={load} className="underline shrink-0">Retry</button>
            </div>
        );
    }

    if (!progress) return null;

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/40 font-bold">
                <Activity className="h-3 w-3" /> Processing Progress
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
                <LegSection legKey="parts" leg={progress.parts} />
                <LegSection legKey="ourdb" leg={progress.ourdb} />
                <LegSection legKey="weight" leg={progress.weight} />
            </div>
        </div>
    );
}
