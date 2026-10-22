// Display-only formatting for Operations financial/date values. NEVER
// computes a new financial fact — every function here takes a value the
// backend already computed (app.operations.finance, via
// OperationsBatchVehicleResponse.financials) and only formats it.
//
// Money-safety rule (see project spec Section 9): a missing value is
// rendered as an em dash, never "$0" — $0 is a real, distinct fact (a
// component priced at zero) that must never be confused with "unknown".

import { COMPLETENESS, WEIGHT_SOURCE } from "./constants";

export function formatMoney(value) {
    if (value === null || value === undefined || value === "") return "—";
    const n = Number(value);
    if (!Number.isFinite(n)) return "—";
    return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatWeight(lb) {
    if (lb === null || lb === undefined || lb === "") return "—";
    const n = Number(lb);
    if (!Number.isFinite(n)) return "—";
    return `${n.toLocaleString("en-US", { maximumFractionDigits: 0 })} lb`;
}

export function formatDate(value) {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString();
}

export function formatDateOnly(value) {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString();
}

// Label + tone for the four real completeness_status values. "Partial"
// is deliberately never represented with >=, <=, or any symbol that
// could be misread as "at least this much" — see spec Section 9.
export const COMPLETENESS_META = {
    [COMPLETENESS.COMPLETE]: { label: "Complete Estimate", tone: "success" },
    [COMPLETENESS.COMPLETE_WITH_ESTIMATES]: { label: "Complete (Est. Cats)", tone: "info" },
    [COMPLETENESS.PARTIAL]: { label: "Partial Estimate", tone: "warning" },
    [COMPLETENESS.NO_DATA]: { label: "No Data", tone: "neutral" },
};

export function completenessMeta(status) {
    return COMPLETENESS_META[status] || { label: status || "Unknown", tone: "neutral" };
}

// True only when the backend itself marked this a full recovery figure
// (financials.total_expected_recovery is non-null) — never inferred any
// other way.
export function isCompleteRecovery(financials) {
    return Boolean(financials) && financials.total_expected_recovery !== null && financials.total_expected_recovery !== undefined;
}

const COMPONENT_LABEL = {
    engine: "Engine",
    transmission: "Transmission",
    cats: "Catalytic",
    scrap: "Scrap",
};

export function componentLabel(name) {
    return COMPONENT_LABEL[name] || name;
}

// Shared weight-status derivation for a single vehicle row — used by both
// VehicleTable and VehicleDetailModal so they never disagree.
//
// weight_resolved_at is the one field that tells us whether Weight has
// finished attempting this vehicle at all (set exactly once, when the
// backend either resolves a real curb weight or gives up and marks it
// NO_DATA — see app.operations.weight). Until it is set, the vehicle is
// still pending (not yet requested, or queued/processing — this client
// cannot distinguish those two for a single row without weight_worker_id,
// which the backend deliberately does not expose per-vehicle; that finer
// breakdown is available in aggregate from GET .../progress instead).
//
// Once weight_resolved_at IS set, curb_weight_lb decides the two possible
// terminal outcomes: present -> resolved successfully; absent -> NO_DATA,
// which is itself terminal and must never be shown as "Pending".
export function deriveWeightStatus(vehicle) {
    if (!vehicle?.weight_resolved_at) {
        return { key: "PENDING", label: "Pending", tone: "neutral" };
    }
    if (vehicle.curb_weight_lb === null || vehicle.curb_weight_lb === undefined) {
        return { key: "NO_DATA", label: "No Data", tone: "neutral" };
    }
    if (vehicle.weight_source === WEIGHT_SOURCE.MANUAL) {
        return { key: "MANUAL", label: "Manual", tone: "success" };
    }
    return { key: "NHTSA", label: "NHTSA", tone: "success" };
}

// One-line summary of a LegProgressResponse bucket for compact display
// next to a Start button — never fabricates a count the backend didn't
// return. `leg` is one of a GET .../progress response's parts/ourdb/weight
// objects (not_requested_count/queued_count/processing_count/done_count/
// failed_count/no_data_count/total).
// Phase K.9 — the one real "is this leg still working" signal, shared by
// the page's poll loop (decides whether to keep polling and when to fire
// a completion notification) and ProcessingControls (decides whether to
// disable a Start button while its own leg is running). Never derived
// from OperationsBatch.status — that field is Parts-only (set by
// app.operations.parts's claim/reconcile functions alone; OurDB and
// Weight never touch it), so it can never tell us whether OurDB or
// Weight is still active. queued_count/processing_count are the only
// backend-computed counts that are true for every one of the three legs
// while real work remains outstanding.
export function isLegActive(leg) {
    if (!leg) return false;
    return (leg.queued_count ?? 0) > 0 || (leg.processing_count ?? 0) > 0;
}

export function summarizeLegProgress(leg) {
    if (!leg || !leg.total) return { label: "No vehicles", tone: "neutral" };
    const { total, not_requested_count = 0, queued_count = 0, processing_count = 0, done_count = 0, failed_count = 0, no_data_count = 0 } = leg;
    if (not_requested_count === total) return { label: "Not started", tone: "neutral" };
    const terminal = done_count + failed_count + no_data_count;
    if (terminal === total) {
        if (failed_count > 0) return { label: `${failed_count} failed`, tone: "danger" };
        return { label: `Done (${done_count}/${total})`, tone: "success" };
    }
    if (processing_count > 0) return { label: `Processing (${done_count}/${total} done)`, tone: "progress" };
    if (queued_count > 0) return { label: `Queued (${done_count}/${total} done)`, tone: "info" };
    return { label: `${done_count}/${total} done`, tone: "neutral" };
}
