"use client";

import React from "react";
import { AlertTriangle, Clock, Loader2, XCircle } from "lucide-react";

// Phase K.53 — one small, accessible state for a vehicle cell. A spinner only for work that
// is really running right now; never inferred from a ticked source or a finished request.
const STATES = {
    NOT_REQUESTED: { text: "—", label: "Not requested", tone: "text-white/25" },
    PENDING: { text: "Pending", label: "Pending", tone: "text-white/35" },
    QUEUED: { text: "Queued", label: "Queued: waiting to start", tone: "text-sky-300/80", Icon: Clock },
    RUNNING: { text: "Running", label: "Running now", tone: "text-sky-300", Icon: Loader2, spin: true },
    NO_MATCH: { text: "No match", label: "Looked up: no match", tone: "text-white/40" },
    NO_DATA: { text: "No data", label: "Looked up: no data", tone: "text-white/40" },
    FAILED: { text: "Failed", label: "Failed", tone: "text-rose-300", Icon: XCircle },
    REVIEW: { text: "Review", label: "Requires review", tone: "text-amber-300", Icon: AlertTriangle },
    NOT_ELIGIBLE: { text: "Not eligible", label: "Not eligible", tone: "text-white/40" },
    // K.53 follow-up: paid-search waiting states, never a spinner.
    PAUSED: { text: "Paused", label: "Waiting: CatDB is paused", tone: "text-amber-200", Icon: Clock },
    WAITING_FOR_DEVICE: { text: "Waiting for device", label: "Waiting for a CatDB device", tone: "text-amber-200", Icon: Clock },
    STALE: { text: "Device stopped", label: "The device stopped reporting on this search", tone: "text-rose-300", Icon: AlertTriangle },
};

export default function CellStatus({ state, detail, compact = false }) {
    const s = STATES[state] || STATES.NOT_REQUESTED;
    const title = [s.label, detail].filter(Boolean).join(": ");
    return (
        <span className={`inline-flex items-center gap-1 ${compact ? "text-[10px]" : "text-xs"} ${s.tone}`} title={title} data-state={state}>
            {s.Icon && <s.Icon aria-hidden="true" className={`h-3 w-3 shrink-0 ${s.spin ? "animate-spin" : ""}`} />}
            <span>{s.text}</span>
            <span className="sr-only">{title}</span>
        </span>
    );
}

// The latest attempt's state, shown under a stored price that it hasn't replaced.
export function LatestAttempt({ state, detail }) {
    if (!state || state === "NOT_REQUESTED") return null;
    return <div className="leading-tight"><CellStatus state={state} detail={detail} compact /></div>;
}

// A leg's stored status as a cell state. "No result" for a finished leg depends on the leg.
export function legState(status, { doneWithoutValue = "NO_DATA", leaseActive } = {}) {
    switch (status) {
        case "QUEUED": return leaseActive ? "RUNNING" : "QUEUED";
        case "PROCESSING": return "RUNNING";
        case "FAILED": return "FAILED";
        case "REVIEW_REQUIRED": return "REVIEW";
        case "DONE": return doneWithoutValue;
        case "NO_DATA": return "NO_DATA";
        case "NOT_REQUESTED": return "NOT_REQUESTED";
        default: return "PENDING";
    }
}
