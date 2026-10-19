// Display-only formatting for Operations financial/date values. NEVER
// computes a new financial fact — every function here takes a value the
// backend already computed (app.operations.finance, via
// OperationsBatchVehicleResponse.financials) and only formats it.
//
// Money-safety rule (see project spec Section 9): a missing value is
// rendered as an em dash, never "$0" — $0 is a real, distinct fact (a
// component priced at zero) that must never be confused with "unknown".

import { COMPLETENESS } from "./constants";

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
