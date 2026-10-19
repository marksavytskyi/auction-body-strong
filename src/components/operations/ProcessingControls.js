"use client";

import React, { useState } from "react";
import toast from "react-hot-toast";
import { Wrench, Database, Gauge, PlayCircle, AlertTriangle } from "lucide-react";

import { startOperationsParts, startOperationsOurDb, startOperationsWeight } from "@/lib/operations/api";
import { CatalyticApiError } from "@/lib/catalytic/http";
import { PARTS_JOB_STATUS_TONE } from "@/lib/operations/constants";
import { Button } from "@/components/ui/button";
import StatusPill from "@/components/catalytic/StatusPill";

// Three independent, explicitly-invoked processing legs — never chained
// or auto-triggered (see spec Section 8). None of these ever touches
// CatDB; Our Database here means the catalytic-converter lookup table,
// never a paid CatDB Android VIN search (that's UI-2's approval flow).
//
// Missing backend contract (see UI-1 report): there is no per-leg
// progress/completed-count/failed-count endpoint. Parts exposes a
// single live status string (parts_job_status); Our Database and
// Weight expose none at the batch level at all — only per-vehicle
// ourdb_status/weight fields, visible in the vehicle table below. This
// component never fabricates counts the backend doesn't provide; it
// shows the one real signal that exists per leg, plus a transient,
// client-only "start requested" confirmation that disappears on reload.
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

export default function ProcessingControls({ batch, onBatchUpdated }) {
    const [busyLeg, setBusyLeg] = useState(null);
    const [startedLegs, setStartedLegs] = useState({});

    const run = async (leg, fn, label) => {
        setBusyLeg(leg);
        try {
            const updated = await fn(batch.id);
            toast.success(`${label} started`);
            setStartedLegs((s) => ({ ...s, [leg]: true }));
            onBatchUpdated?.(updated);
        } catch (e) {
            toast.error(e instanceof CatalyticApiError ? e.message : `Failed to start ${label}`);
        } finally {
            setBusyLeg(null);
        }
    };

    return (
        <div className="grid gap-3 sm:grid-cols-3">
            <LegCard
                icon={Wrench}
                title="Parts Analysis"
                description="Engine & transmission pricing"
                enabled={batch.run_parts}
                busy={busyLeg === "parts"}
                onStart={() => run("parts", startOperationsParts, "Parts analysis")}
            >
                {batch.parts_job_status ? (
                    <StatusPill label={batch.parts_job_status} tone={PARTS_JOB_STATUS_TONE[batch.parts_job_status] || "neutral"} />
                ) : startedLegs.parts ? (
                    <StatusPill label="Start requested" tone="info" />
                ) : (
                    <StatusPill label="Not started" tone="neutral" />
                )}
                {!batch.run_parts && (
                    <span className="text-[11px] text-white/35 inline-flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> disabled for this batch</span>
                )}
            </LegCard>

            <LegCard
                icon={Database}
                title="Our Database Analysis"
                description="Catalytic converter lookup (never a paid CatDB search)"
                enabled={batch.run_ourdb}
                busy={busyLeg === "ourdb"}
                onStart={() => run("ourdb", startOperationsOurDb, "Our Database analysis")}
            >
                {startedLegs.ourdb ? (
                    <StatusPill label="Start requested" tone="info" />
                ) : (
                    <StatusPill label="Not started" tone="neutral" />
                )}
                {!batch.run_ourdb && (
                    <span className="text-[11px] text-white/35 inline-flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> disabled for this batch</span>
                )}
            </LegCard>

            <LegCard
                icon={Gauge}
                title="Weight Analysis"
                description="NHTSA curb weight lookup"
                enabled={batch.run_weight}
                busy={busyLeg === "weight"}
                onStart={() => run("weight", startOperationsWeight, "Weight analysis")}
            >
                {startedLegs.weight ? (
                    <StatusPill label="Start requested" tone="info" />
                ) : (
                    <StatusPill label="Not started" tone="neutral" />
                )}
                {!batch.run_weight && (
                    <span className="text-[11px] text-white/35 inline-flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> disabled for this batch</span>
                )}
            </LegCard>
        </div>
    );
}
