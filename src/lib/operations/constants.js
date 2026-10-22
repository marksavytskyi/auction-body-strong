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

// Field names on LegProgressResponse (app/operations/schemas.py), per leg,
// in display order. Parts and OurDb use the real LEG_STATUS enum end to
// end; Weight has no discrete status column — "no_data_count" is a
// terminal bucket computed server-side (curb_weight_lb never resolved),
// distinct from "not_requested_count" (never asked). Each leg's own list
// below is the "only display categories that make sense" whitelist —
// e.g. Weight is never shown a "queued"/"processing" split as confidently
// as Parts/OurDb since weight_worker_id isn't exposed to this client, but
// the /progress endpoint computes those counts correctly server-side, so
// they are shown here too.
export const PROGRESS_FIELDS = {
    parts: ["not_requested_count", "queued_count", "processing_count", "done_count", "failed_count"],
    ourdb: ["not_requested_count", "queued_count", "processing_count", "done_count", "failed_count"],
    weight: ["not_requested_count", "queued_count", "processing_count", "done_count", "no_data_count"],
};

export const PROGRESS_BUCKET_LABEL = {
    not_requested_count: "Not requested",
    queued_count: "Queued",
    processing_count: "Processing",
    done_count: "Done",
    failed_count: "Failed",
    no_data_count: "No data",
};

export const PROGRESS_BUCKET_TONE = {
    not_requested_count: "neutral",
    queued_count: "info",
    processing_count: "progress",
    done_count: "success",
    failed_count: "danger",
    no_data_count: "neutral",
};

export const PROGRESS_LEG_LABEL = {
    parts: "Parts",
    ourdb: "Our Database",
    weight: "Weight",
};

// ─── CatDB paid-search approval (UI-2) ──────────────────────────────────
// Mirrors app/operations/catdb_approval.py's VIN_CATEGORY_* constants
// exactly — these classify each VIN in a GET .../catdb/preview response.
// NEVER_SEARCHED is the only category the backend will ever spend quota
// on (approve_catdb slices preview.approvable_new_search_vins, which is
// built only from this category); every other category already has a
// settled or disqualifying outcome and is never a "retry" candidate.
export const CATDB_VIN_CATEGORY = {
    COMPLETED_REUSABLE: "COMPLETED_REUSABLE",
    ACTIVE_EXISTING_JOB: "ACTIVE_EXISTING_JOB",
    UNCERTAIN_SUBMISSION: "UNCERTAIN_SUBMISSION",
    CONCLUSIVE_NO_DATA: "CONCLUSIVE_NO_DATA",
    NEVER_SEARCHED: "NEVER_SEARCHED",
    INELIGIBLE: "INELIGIBLE",
};

export const CATDB_VIN_CATEGORY_LABEL = {
    [CATDB_VIN_CATEGORY.COMPLETED_REUSABLE]: "Reusable (already completed)",
    [CATDB_VIN_CATEGORY.ACTIVE_EXISTING_JOB]: "Active existing search",
    [CATDB_VIN_CATEGORY.UNCERTAIN_SUBMISSION]: "Uncertain — needs review",
    [CATDB_VIN_CATEGORY.CONCLUSIVE_NO_DATA]: "No data found (conclusive)",
    [CATDB_VIN_CATEGORY.NEVER_SEARCHED]: "New paid search needed",
    [CATDB_VIN_CATEGORY.INELIGIBLE]: "Blocked / ineligible",
};

export const CATDB_VIN_CATEGORY_TONE = {
    [CATDB_VIN_CATEGORY.COMPLETED_REUSABLE]: "success",
    [CATDB_VIN_CATEGORY.ACTIVE_EXISTING_JOB]: "info",
    [CATDB_VIN_CATEGORY.UNCERTAIN_SUBMISSION]: "warning",
    [CATDB_VIN_CATEGORY.CONCLUSIVE_NO_DATA]: "neutral",
    [CATDB_VIN_CATEGORY.NEVER_SEARCHED]: "progress",
    [CATDB_VIN_CATEGORY.INELIGIBLE]: "danger",
};

// Mirrors app/operations/catdb_approval_models.py's APPROVAL_STATUS_*
// exactly. NEEDS_RECONCILIATION is never auto-retried by the backend
// (see _advance_approval_locked's own docstring) — the UI's "Refresh
// CatDB Results" reconcile action is the one safe, explicit way to make
// progress on it, and that action itself only ever reads existing
// CatDBJob state, never creates a new search.
export const CATDB_APPROVAL_STATUS = {
    PREPARING: "PREPARING",
    IN_PROGRESS: "IN_PROGRESS",
    COMPLETE: "COMPLETE",
    NEEDS_RECONCILIATION: "NEEDS_RECONCILIATION",
};

export const CATDB_APPROVAL_STATUS_LABEL = {
    [CATDB_APPROVAL_STATUS.PREPARING]: "Preparing",
    [CATDB_APPROVAL_STATUS.IN_PROGRESS]: "In Progress",
    [CATDB_APPROVAL_STATUS.COMPLETE]: "Complete",
    [CATDB_APPROVAL_STATUS.NEEDS_RECONCILIATION]: "Needs Reconciliation",
};

export const CATDB_APPROVAL_STATUS_TONE = {
    [CATDB_APPROVAL_STATUS.PREPARING]: "neutral",
    [CATDB_APPROVAL_STATUS.IN_PROGRESS]: "progress",
    [CATDB_APPROVAL_STATUS.COMPLETE]: "success",
    [CATDB_APPROVAL_STATUS.NEEDS_RECONCILIATION]: "warning",
};

// "RECONCILED" is the only value a successful preview can ever carry —
// build_catdb_preview itself fails closed with a 503
// (OperationsCatdbQuotaUnavailableError) before returning a response at
// all when the current subscription period is still "PENDING" (not yet
// explicitly reconciled against historical usage). Listed here only so
// this value is never hand-typed as a magic string at the call site.
export const CATDB_QUOTA_RECONCILIATION_STATUS = {
    RECONCILED: "RECONCILED",
    PENDING: "PENDING",
};

// Phase K.5 — app.operations.catdb_approval.OPERATIONS_CATDB_DISABLED_ERROR_CODE's
// own value, prefixed onto that error's message (see its docstring) so a
// 503 caused by the server-side OPERATIONS_CATDB_ENABLED flag being off
// can be told apart from a 503 caused by quota exhaustion/misconfiguration
// (QuotaUnavailableError) — same HTTP status, different real cause.
export const OPERATIONS_CATDB_DISABLED_ERROR_CODE = "OPERATIONS_CATDB_DISABLED";
