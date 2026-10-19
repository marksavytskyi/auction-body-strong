// Mirrors app/operations/models.py and app/operations/finance.py exactly —
// every string here is a real backend enum value, never invented. Keep in
// lockstep with the backend; these are display labels/tones only, never
// used to decide authorization (the backend remains the sole authority).

export const BATCH_STATUS = {
    CREATED: "CREATED",
    PROCESSING: "PROCESSING",
    DONE: "DONE",
    FAILED: "FAILED",
};

export const LEG_STATUS = {
    NOT_REQUESTED: "NOT_REQUESTED",
    QUEUED: "QUEUED",
    PROCESSING: "PROCESSING",
    DONE: "DONE",
    FAILED: "FAILED",
};

// catdb_status carries two additional terminal values beyond LEG_STATUS —
// not used by UI-1 (CatDB approval UI is UI-2), listed for completeness.
export const CATDB_STATUS_EXTRA = {
    REVIEW_REQUIRED: "REVIEW_REQUIRED",
    NO_RESULT: "NO_RESULT",
    SKIPPED_INELIGIBLE: "SKIPPED_INELIGIBLE",
};

export const OVERALL_STATUS = {
    PENDING: "PENDING",
    PROCESSING: "PROCESSING",
    PARTIAL: "PARTIAL",
    DONE: "DONE",
    FAILED: "FAILED",
};

export const COMPLETENESS = {
    COMPLETE: "COMPLETE",
    COMPLETE_WITH_ESTIMATES: "COMPLETE_WITH_ESTIMATES",
    PARTIAL: "PARTIAL",
    NO_DATA: "NO_DATA",
};

export const CATS_SOURCE = {
    LIVE_CATDB: "LIVE_CATDB",
    OUR_DATABASE_VERIFIED: "OUR_DATABASE_VERIFIED",
    OUR_DATABASE_ESTIMATE: "OUR_DATABASE_ESTIMATE",
    NONE: "NONE",
};

export const CATS_SOURCE_LABEL = {
    [CATS_SOURCE.LIVE_CATDB]: "Live CatDB",
    [CATS_SOURCE.OUR_DATABASE_VERIFIED]: "Our Database",
    [CATS_SOURCE.OUR_DATABASE_ESTIMATE]: "Our Database (estimate)",
    [CATS_SOURCE.NONE]: "No source selected",
};

export const WEIGHT_SOURCE = {
    NHTSA: "NHTSA",
    MANUAL: "MANUAL",
    UNKNOWN: "UNKNOWN",
};

// Fixed sort whitelist mirrored from app/operations/services.VEHICLE_SORT_FIELDS
// (base fields) union app/operations/finance.FINANCIAL_SORT_FIELDS. Any
// sort_by sent to the backend MUST be one of these — the backend 400s on
// anything else, so the table never offers a column the API can't sort.
export const VEHICLE_SORT_FIELDS = new Set([
    "source_row_number",
    "year",
    "make",
    "model",
    "created_at",
    "overall_status",
    "known_components_subtotal",
    "total_expected_recovery",
    "scrap_value",
    "cats_value",
]);

// Mirrors the backend's own overall_status filter whitelist (there is no
// separate enum module-side; OVERALL_STATUS above IS the whitelist).
export const OVERALL_STATUS_FILTERS = Object.values(OVERALL_STATUS);

// Tone for StatusPill (src/components/catalytic/StatusPill.js) — visual
// only, never used for logic.
export const BATCH_STATUS_TONE = {
    [BATCH_STATUS.CREATED]: "neutral",
    [BATCH_STATUS.PROCESSING]: "progress",
    [BATCH_STATUS.DONE]: "success",
    [BATCH_STATUS.FAILED]: "danger",
};

export const LEG_STATUS_TONE = {
    [LEG_STATUS.NOT_REQUESTED]: "neutral",
    [LEG_STATUS.QUEUED]: "info",
    [LEG_STATUS.PROCESSING]: "progress",
    [LEG_STATUS.DONE]: "success",
    [LEG_STATUS.FAILED]: "danger",
    [CATDB_STATUS_EXTRA.REVIEW_REQUIRED]: "warning",
    [CATDB_STATUS_EXTRA.NO_RESULT]: "neutral",
    [CATDB_STATUS_EXTRA.SKIPPED_INELIGIBLE]: "neutral",
};

export const OVERALL_STATUS_TONE = {
    [OVERALL_STATUS.PENDING]: "neutral",
    [OVERALL_STATUS.PROCESSING]: "progress",
    [OVERALL_STATUS.PARTIAL]: "warning",
    [OVERALL_STATUS.DONE]: "success",
    [OVERALL_STATUS.FAILED]: "danger",
};

// "processing"/"done"/"failed" — app.operations.parts.get_live_parts_job_status's
// own live values (lowercase, mirrors Parts' own job.meta["status"]).
export const PARTS_JOB_STATUS_TONE = {
    processing: "progress",
    done: "success",
    failed: "danger",
};
