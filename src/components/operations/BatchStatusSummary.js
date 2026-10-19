"use client";

import React, { useEffect, useState } from "react";
import { Info } from "lucide-react";

import { getOperationsBatchOverallStatusCounts } from "@/lib/operations/api";
import { OVERALL_STATUS, OVERALL_STATUS_FILTERS, OVERALL_STATUS_TONE } from "@/lib/operations/constants";
import { CatalyticApiError } from "@/lib/catalytic/http";

const LABEL = {
    [OVERALL_STATUS.PENDING]: "Pending",
    [OVERALL_STATUS.PROCESSING]: "Processing",
    [OVERALL_STATUS.PARTIAL]: "Partial",
    [OVERALL_STATUS.DONE]: "Done",
    [OVERALL_STATUS.FAILED]: "Failed",
};

const TONE_TEXT = {
    neutral: "text-white/70",
    progress: "text-violet-300",
    warning: "text-amber-300",
    success: "text-emerald-300",
    danger: "text-rose-300",
};

// Overall vehicle status (OperationsBatchVehicle.overall_status) across
// every leg combined — the only aggregate the backend actually
// computes server-side (via the vehicle list's own `total`, read with
// limit=1 so this never fetches full rows). Deliberately NOT broken
// down per leg (Parts/OurDB/Weight each have no such aggregate — see
// ProcessingControls and the UI-1 report's missing-contracts section),
// and never a dollar figure.
export default function BatchStatusSummary({ batchId, refreshKey }) {
    const [counts, setCounts] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;
        getOperationsBatchOverallStatusCounts(batchId, OVERALL_STATUS_FILTERS)
            .then((c) => { if (!cancelled) { setCounts(c); setError(""); } })
            .catch((e) => { if (!cancelled) setError(e instanceof CatalyticApiError ? e.message : "Failed to load status summary"); });
        return () => { cancelled = true; };
    }, [batchId, refreshKey]);

    if (error) return null; // non-critical — the vehicle table below is the real source of truth
    if (!counts) return null;

    return (
        <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/40 font-bold mb-3">
                <Info className="h-3 w-3" /> Overall Vehicle Status (all legs combined)
            </div>
            <div className="grid grid-cols-5 gap-2">
                {OVERALL_STATUS_FILTERS.map((status) => (
                    <div key={status} className="text-center">
                        <div className={`text-lg font-black ${TONE_TEXT[OVERALL_STATUS_TONE[status]] || "text-white/90"}`}>{counts[status] ?? 0}</div>
                        <div className="text-[9px] uppercase tracking-wider text-white/40 font-bold mt-0.5">{LABEL[status]}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}
