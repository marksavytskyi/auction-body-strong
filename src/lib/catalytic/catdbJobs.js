// Phase K.51 — how CatDB Automation names each job outcome. The words follow the
// backend's evidence: TIMEOUT means the outcome is unknown, never "no converter".

export const OUTCOME_LABEL = {
    QUEUED: "Queued",
    RUNNING: "Running",
    COMPLETED: "Completed",
    NO_RESULT: "No result",
    TIMEOUT: "Timed out",
    FAILED: "Failed",
    MANUAL_REVIEW: "Manual review",
    CANCELLED: "Cancelled",
};

export const OUTCOME_TONE = {
    QUEUED: "border-sky-500/30 bg-sky-500/10 text-sky-200",
    RUNNING: "border-sky-500/30 bg-sky-500/10 text-sky-200",
    COMPLETED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
    NO_RESULT: "border-white/15 bg-white/5 text-white/70",
    TIMEOUT: "border-amber-500/30 bg-amber-500/10 text-amber-200",
    FAILED: "border-rose-500/30 bg-rose-500/10 text-rose-200",
    MANUAL_REVIEW: "border-amber-500/30 bg-amber-500/10 text-amber-200",
    CANCELLED: "border-white/15 bg-white/5 text-white/50",
};

// The filter choices, by outcome rather than raw status.
export const OUTCOME_FILTERS = [
    { id: "", label: "All" },
    { id: "QUEUED", label: "Queued" },
    { id: "RUNNING", label: "Running" },
    { id: "COMPLETED", label: "Completed" },
    { id: "NO_RESULT", label: "No result" },
    { id: "TIMEOUT", label: "Timed out" },
    { id: "FAILED", label: "Failed" },
    { id: "MANUAL_REVIEW", label: "Manual review" },
    { id: "CANCELLED", label: "Cancelled" },
];

export const FINISHED_STATUSES = ["COMPLETED", "FAILED", "CANCELLED", "MANUAL_REVIEW"];
