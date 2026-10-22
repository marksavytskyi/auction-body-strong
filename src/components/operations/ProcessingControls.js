"use client";

import React, { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Wrench, Database, Gauge, PlayCircle, AlertTriangle } from "lucide-react";

import { startOperationsParts, startOperationsOurDb, startOperationsWeight, getOperationsBatchProgress } from "@/lib/operations/api";
import { CatalyticApiError } from "@/lib/catalytic/http";
import { Button } from "@/components/ui/button";
import StatusPill from "@/components/catalytic/StatusPill";
import { summarizeLegProgress, isLegActive } from "@/lib/operations/format";

// Three independent, explicitly-invoked processing legs — never chained
// or auto-triggered (see spec Section 8). None of these ever touches
// CatDB; Our Database here means the catalytic-converter lookup table,
// never a paid CatDB Android VIN search (that's UI-2's approval flow).
//
// The compact summary next to each Start button comes from the real
// GET .../progress endpoint (see summarizeLegProgress) — never from
// client-only "start requested" state. The full per-bucket breakdown
// lives in ProcessingProgress below this component; this one only shows
// a one-line summary per leg so the Start buttons stay scannable.
function LegCard({ icon: Icon, title, description, enabled, busy, onStart, children }) {
    return (
        <div className="rounded-2xl border border-white/10 bg-black/25 p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 rounded-xl border border-white/10 bg-white/5 shrink-0">
                        <Icon className="h-4 w-4 text-emerald-300" />
                    </div>
                    <div className="min-w-0">
                        <div className="text-sm font-bold text-white/90">{title}</div>
                        <div className="text-[11px] text-white/40">{description}</div>
                    </div>
                </div>
            </div>
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">{children}</div>
                <Button size="sm" className="rounded-xl" disabled={!enabled || busy} isLoading={busy} onClick={onStart}>
                    {!busy && <PlayCircle className="h-3.5 w-3.5" />} Start
                </Button>
            </div>
        </div>
    );
}

export default function ProcessingControls({ batch, progress, refreshKey, onBatchUpdated }) {
    const [busyLeg, setBusyLeg] = useState(null);
    const [ownProgress, setOwnProgress] = useState(progress || null);

    // Progress can either be passed down by a parent that already fetched
    // it (avoids a duplicate request), or fetched here directly when no
    // `progress` prop is given — this component must never show fabricated
    // status if left to run standalone.
    //
    // Phase H/I-B: `refreshKey` is included here so this refetches in
    // lockstep with the page's own poll tick, exactly like
    // ProcessingProgress below it — previously this effect depended only
    // on `[progress, loadProgress]`, both stable across every poll tick
    // (the page never passed a `progress` prop, and loadProgress is
    // memoized on batch.id alone), so this summary fetched once on mount
    // and never again while the batch kept processing, going stale next
    // to ProcessingProgress's own live view of the exact same data. This
    // reuses the page's EXISTING refreshKey/poll cadence — no second
    // interval is ever created here.
    const loadProgress = useCallback(async () => {
        try {
            const data = await getOperationsBatchProgress(batch.id);
            setOwnProgress(data);
        } catch {
            // Non-critical here — ProcessingProgress below is the dedicated
            // error-surfacing view for this same endpoint.
        }
    }, [batch.id]);

    useEffect(() => {
        if (progress) { setOwnProgress(progress); return; }
        loadProgress();
    }, [progress, loadProgress, refreshKey]);

    const effectiveProgress = progress || ownProgress;

    const run = async (leg, fn, label) => {
        setBusyLeg(leg);
        try {
            const updated = await fn(batch.id);
            toast.success(`${label} started`);
            // Phase K.9 — tells the page which leg just started so its
            // poll loop can mark it active immediately, before the next
            // tick even runs (see page.js's own handleBatchUpdated).
            onBatchUpdated?.(updated, leg);
            if (!progress) loadProgress();
        } catch (e) {
            toast.error(e instanceof CatalyticApiError ? e.message : `Failed to start ${label}`);
        } finally {
            setBusyLeg(null);
        }
    };

    const legSummary = (legKey) => {
        const summary = summarizeLegProgress(effectiveProgress?.[legKey]);
        return <StatusPill label={summary.label} tone={summary.tone} />;
    };

    return (
        <div className="grid gap-3 sm:grid-cols-3">
            <LegCard
                icon={Wrench}
                title="Parts Analysis"
                description="Engine & transmission pricing"
                enabled={batch.run_parts && !isLegActive(effectiveProgress?.parts)}
                busy={busyLeg === "parts"}
                onStart={() => run("parts", startOperationsParts, "Parts analysis")}
            >
                {legSummary("parts")}
                {!batch.run_parts && (
                    <span className="text-[11px] text-white/35 inline-flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> disabled for this batch</span>
                )}
            </LegCard>

            <LegCard
                icon={Database}
                title="Our Database Analysis"
                description="Catalytic converter lookup (never a paid CatDB search)"
                enabled={batch.run_ourdb && !isLegActive(effectiveProgress?.ourdb)}
                busy={busyLeg === "ourdb"}
                onStart={() => run("ourdb", startOperationsOurDb, "Our Database analysis")}
            >
                {legSummary("ourdb")}
                {!batch.run_ourdb && (
                    <span className="text-[11px] text-white/35 inline-flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> disabled for this batch</span>
                )}
            </LegCard>

            <LegCard
                icon={Gauge}
                title="Weight Analysis"
                description="NHTSA curb weight lookup"
                enabled={batch.run_weight && !isLegActive(effectiveProgress?.weight)}
                busy={busyLeg === "weight"}
                onStart={() => run("weight", startOperationsWeight, "Weight analysis")}
            >
                {legSummary("weight")}
                {!batch.run_weight && (
                    <span className="text-[11px] text-white/35 inline-flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> disabled for this batch</span>
                )}
            </LegCard>
        </div>
    );
}
