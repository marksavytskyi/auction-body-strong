// Typed client for /operations/* — matches app/operations/router.py
// exactly (backend commit 78765fa). OWNER/ADMIN only; the backend is the
// real enforcement boundary (require_roles(ADMIN_ROLES) on every route),
// this client never decides authorization itself.
//
// Deliberately thin: every function maps 1:1 to one backend endpoint,
// with the exact query/body shape that endpoint accepts. No endpoint is
// invented.
//
// Reuses the existing generic request()/axiosInstance from
// ./catalytic/http.js (already proxies via /api, attaches the bearer
// token, and handles 401 — see that module) rather than building a
// second HTTP layer.

import { request, axiosInstance, CatalyticApiError } from "@/lib/catalytic/http";

const BASE = "/operations";

// ─── batches ────────────────────────────────────────────────────────────

export function uploadOperationsBatch(file, options = {}) {
    const form = new FormData();
    form.append("file", file);
    const params = {};
    if (options.defaultScrapPercentage !== undefined) params.default_scrap_percentage = options.defaultScrapPercentage;
    if (options.defaultScrapRateUsdPerLb !== undefined) params.default_scrap_rate_usd_per_lb = options.defaultScrapRateUsdPerLb;
    if (options.defaultCatsSourcePolicy !== undefined) params.default_cats_source_policy = options.defaultCatsSourcePolicy;
    if (options.runCatdb !== undefined) params.run_catdb = options.runCatdb;
    if (options.runOurdb !== undefined) params.run_ourdb = options.runOurdb;
    return request(
        () => axiosInstance.post(`${BASE}/batches`, form, { headers: { "Content-Type": "multipart/form-data" }, params }),
        "Failed to upload Operations batch CSV"
    );
}

export function listOperationsBatches({ limit = 50, offset = 0 } = {}) {
    return request(
        () => axiosInstance.get(`${BASE}/batches`, { params: { limit, offset } }),
        "Failed to load Operations batches"
    );
}

export function getOperationsBatch(batchId) {
    return request(
        () => axiosInstance.get(`${BASE}/batches/${encodeURIComponent(batchId)}`),
        "Failed to load Operations batch"
    );
}

// status: filters by overall_status (OVERALL_STATUS_FILTERS); sort_by
// must be one of VEHICLE_SORT_FIELDS — the backend 400s on anything else.
export function listOperationsBatchVehicles(batchId, { limit = 50, offset = 0, search, status, sortBy, sortDir } = {}) {
    const params = { limit, offset };
    if (search) params.search = search;
    if (status) params.status = status;
    if (sortBy) params.sort_by = sortBy;
    if (sortDir) params.sort_dir = sortDir;
    return request(
        () => axiosInstance.get(`${BASE}/batches/${encodeURIComponent(batchId)}/vehicles`, { params }),
        "Failed to load batch vehicles"
    );
}

// ─── processing controls — each is an independent, explicitly-invoked
// backend action; none is ever triggered automatically by this client. ──

export function startOperationsParts(batchId) {
    return request(
        () => axiosInstance.post(`${BASE}/batches/${encodeURIComponent(batchId)}/parts/start`),
        "Failed to start Parts analysis"
    );
}

export function startOperationsOurDb(batchId) {
    return request(
        () => axiosInstance.post(`${BASE}/batches/${encodeURIComponent(batchId)}/ourdb/start`),
        "Failed to start Our Database analysis"
    );
}

export function startOperationsWeight(batchId) {
    return request(
        () => axiosInstance.post(`${BASE}/batches/${encodeURIComponent(batchId)}/weight/start`),
        "Failed to start Weight analysis"
    );
}

// ─── manual overrides ───────────────────────────────────────────────────

// curbWeightLb present -> set a manual override; null/undefined -> clear
// it back to UNKNOWN (never restores a prior NHTSA value — see
// app.operations.weight.clear_manual_weight).
export function setOperationsVehicleWeight(batchId, vehicleId, curbWeightLb) {
    return request(
        () => axiosInstance.put(
            `${BASE}/batches/${encodeURIComponent(batchId)}/vehicles/${encodeURIComponent(vehicleId)}/weight`,
            { curb_weight_lb: curbWeightLb ?? null }
        ),
        "Failed to update vehicle weight"
    );
}

export function setOperationsBatchScrapDefaults(batchId, { defaultScrapPercentage, defaultScrapRateUsdPerLb } = {}) {
    const body = {};
    if (defaultScrapPercentage !== undefined) body.default_scrap_percentage = defaultScrapPercentage;
    if (defaultScrapRateUsdPerLb !== undefined) body.default_scrap_rate_usd_per_lb = defaultScrapRateUsdPerLb;
    return request(
        () => axiosInstance.put(`${BASE}/batches/${encodeURIComponent(batchId)}/scrap-defaults`, body),
        "Failed to update batch scrap defaults"
    );
}

// Each field: omit -> unchanged; explicit null -> clear override back to
// batch default; value -> set. Callers must only include keys they mean
// to touch (see app.operations.schemas.VehicleScrapOverrideRequest).
export function setOperationsVehicleScrapOverride(batchId, vehicleId, updates = {}) {
    const body = {};
    if ("scrapPercentageOverride" in updates) body.scrap_percentage_override = updates.scrapPercentageOverride;
    if ("scrapRateOverride" in updates) body.scrap_rate_override = updates.scrapRateOverride;
    return request(
        () => axiosInstance.put(
            `${BASE}/batches/${encodeURIComponent(batchId)}/vehicles/${encodeURIComponent(vehicleId)}/scrap`,
            body
        ),
        "Failed to update vehicle scrap override"
    );
}

// ─── financial summary, progress, export (Phase G backend contracts) ───

export function getOperationsBatchFinancialSummary(batchId) {
    return request(
        () => axiosInstance.get(`${BASE}/batches/${encodeURIComponent(batchId)}/financial-summary`),
        "Failed to load batch financial summary"
    );
}

export function getOperationsBatchProgress(batchId) {
    return request(
        () => axiosInstance.get(`${BASE}/batches/${encodeURIComponent(batchId)}/progress`),
        "Failed to load batch progress"
    );
}

// Blob.text() is the normal path, but FileReader is used instead since
// it is universally supported (unlike Blob.prototype.text, missing in
// some test/runtime environments) and this is the only place a Blob's
// contents are ever read as text in this client.
function blobToText(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(blob);
    });
}

const CONTENT_DISPOSITION_FILENAME_RE = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i;

function filenameFromContentDisposition(headerValue, fallback) {
    if (!headerValue) return fallback;
    const match = CONTENT_DISPOSITION_FILENAME_RE.exec(headerValue);
    if (!match) return fallback;
    try {
        return decodeURIComponent(match[1]);
    } catch {
        return match[1];
    }
}

// Downloads the backend-generated CSV as a Blob and returns it together
// with the filename the backend chose (Content-Disposition), falling
// back to a reasonable default only if that header is somehow absent.
// Uses responseType: "blob" directly (not the generic request() helper)
// because an error response under that responseType also arrives as a
// Blob rather than parsed JSON — so error bodies need their own
// extraction path below instead of the usual error.response.data.detail.
export async function downloadOperationsBatchExportCsv(batchId) {
    try {
        const response = await axiosInstance.get(
            `${BASE}/batches/${encodeURIComponent(batchId)}/export`,
            { responseType: "blob" }
        );
        const filename = filenameFromContentDisposition(
            response.headers?.["content-disposition"],
            `operations_batch_${batchId}_export.csv`
        );
        return { blob: response.data, filename };
    } catch (error) {
        const data = error?.response?.data;
        let message = "Failed to export batch CSV";
        if (data instanceof Blob) {
            try {
                const text = await blobToText(data);
                const parsed = JSON.parse(text);
                if (parsed?.detail) message = parsed.detail;
            } catch {
                // response body wasn't JSON text; fall back to the default message
            }
        } else if (data?.detail) {
            message = data.detail;
        } else if (error?.message) {
            message = error.message;
        }
        throw new CatalyticApiError(message, { status: error?.response?.status, cause: error });
    }
}

// ─── CatDB paid-search approval (UI-2 backend contracts — Phase F2B/F2C/F2D) ───
//
// Matches app/operations/catdb_approval_schemas.py and
// app/operations/router.py's own "Operations -> CatDB approval" section
// exactly. This is a SEPARATE, paid, subscription-backed VIN search
// process — never to be confused with Our Database (the free local
// lookup table). No function here ever starts a search on its own:
// previewOperationsCatdbSearches is strictly read-only, and
// approveOperationsCatdbSearches requires the caller to pass an
// explicit confirm:true plus a fingerprint from a just-fetched preview
// — there is no "default" approval this client can trigger by itself.

export function previewOperationsCatdbSearches(batchId) {
    return request(
        () => axiosInstance.get(`${BASE}/batches/${encodeURIComponent(batchId)}/catdb/preview`),
        "Failed to load CatDB preview"
    );
}

// previewFingerprint/maxNewSearches/confirm map 1:1 to
// CatDBApprovalRequest's own preview_fingerprint/max_new_searches/confirm
// fields — never renamed, never defaulted here. confirm must be passed
// as true explicitly by the caller; this function never supplies a
// default for it.
export function approveOperationsCatdbSearches(batchId, { previewFingerprint, maxNewSearches, confirm }) {
    return request(
        () => axiosInstance.post(`${BASE}/batches/${encodeURIComponent(batchId)}/catdb/approve`, {
            preview_fingerprint: previewFingerprint,
            max_new_searches: maxNewSearches,
            confirm,
        }),
        "Failed to submit CatDB approval"
    );
}

export function listOperationsCatdbApprovals(batchId, { limit = 10, offset = 0 } = {}) {
    return request(
        () => axiosInstance.get(`${BASE}/batches/${encodeURIComponent(batchId)}/catdb/approvals`, { params: { limit, offset } }),
        "Failed to load CatDB approval history"
    );
}

// Pull-based sync only — copies the CURRENT state of already-existing
// CatDBJobs into this batch's own vehicle rows. Never creates a new
// CatDBJob, never spends quota, never starts a worker (see
// app.operations.catdb_approval.reconcile_catdb_results's own
// docstring, mirrored exactly by this function's name).
export function reconcileOperationsCatdbResults(batchId) {
    return request(
        () => axiosInstance.post(`${BASE}/batches/${encodeURIComponent(batchId)}/catdb/reconcile`),
        "Failed to reconcile CatDB results"
    );
}

// ─── CatDB subscription & device management — Phase K.11 ───────────────
// Matches app/operations/catdb_subscription_schemas.py and
// app/operations/router.py's own "CatDB subscription & device
// management" section exactly. OWNER/ADMIN only — enforced server-side;
// this client never decides authorization itself.

export function listOperationsCatdbSubscriptions() {
    return request(
        () => axiosInstance.get(`${BASE}/catdb/subscriptions`),
        "Failed to load CatDB subscriptions"
    );
}

export function createOperationsCatdbSubscription({ displayName, accountEmail, resetDay, monthlyLimit }) {
    return request(
        () => axiosInstance.post(`${BASE}/catdb/subscriptions`, {
            display_name: displayName, account_email: accountEmail, reset_day: resetDay, monthly_limit: monthlyLimit,
        }),
        "Failed to create CatDB subscription"
    );
}

export function updateOperationsCatdbSubscription(subscriptionId, { displayName, accountEmail, resetDay, monthlyLimit, enabled } = {}) {
    const body = {};
    if (displayName !== undefined) body.display_name = displayName;
    if (accountEmail !== undefined) body.account_email = accountEmail;
    if (resetDay !== undefined) body.reset_day = resetDay;
    if (monthlyLimit !== undefined) body.monthly_limit = monthlyLimit;
    if (enabled !== undefined) body.enabled = enabled;
    return request(
        () => axiosInstance.patch(`${BASE}/catdb/subscriptions/${encodeURIComponent(subscriptionId)}`, body),
        "Failed to update CatDB subscription"
    );
}

export function listOperationsCatdbBalanceAdjustments(subscriptionId) {
    return request(
        () => axiosInstance.get(`${BASE}/catdb/subscriptions/${encodeURIComponent(subscriptionId)}/adjustments`),
        "Failed to load CatDB balance adjustment history"
    );
}

// Section 3's own "Adjust Search Balance" action — the admin supplies
// the actual remaining searches on the real external account, and the
// backend computes and records whatever adjustment is required against
// existing usage/reservations (app.operations.catdb_subscriptions.
// adjust_search_balance). Never overwrites immutable search history.
export function adjustOperationsCatdbSearchBalance(subscriptionId, { actualRemaining, reason }) {
    return request(
        () => axiosInstance.post(`${BASE}/catdb/subscriptions/${encodeURIComponent(subscriptionId)}/adjust-balance`, {
            actual_remaining: actualRemaining, reason,
        }),
        "Failed to adjust CatDB search balance"
    );
}

export function listOperationsCatdbSubscriptionRenewals(subscriptionId) {
    return request(
        () => axiosInstance.get(`${BASE}/catdb/subscriptions/${encodeURIComponent(subscriptionId)}/renewals`),
        "Failed to load CatDB subscription renewal history"
    );
}

// Section 6's own "Confirm Subscription Renewal" action — never assumed
// automatically just because the reset date arrived (see
// app.operations.catdb_subscriptions.confirm_subscription_renewal).
export function confirmOperationsCatdbSubscriptionRenewal(subscriptionId) {
    return request(
        () => axiosInstance.post(`${BASE}/catdb/subscriptions/${encodeURIComponent(subscriptionId)}/confirm-renewal`, {}),
        "Failed to confirm CatDB subscription renewal"
    );
}

// Section 2's own admin table — one row per existing CatDB device
// (Android worker), joined with its assigned subscription's live
// used/reserved/remaining counts. null fields mean "no subscription
// assigned" or "not yet reconciled" — never a fabricated 0.
export function listOperationsCatdbDevices() {
    return request(
        () => axiosInstance.get(`${BASE}/catdb/devices`),
        "Failed to load CatDB devices"
    );
}

export function updateOperationsCatdbDevice(deviceId, { displayName, subscriptionId, unassignSubscription, enabled } = {}) {
    const body = {};
    if (displayName !== undefined) body.display_name = displayName;
    if (subscriptionId !== undefined) body.subscription_id = subscriptionId;
    if (unassignSubscription !== undefined) body.unassign_subscription = unassignSubscription;
    if (enabled !== undefined) body.enabled = enabled;
    return request(
        () => axiosInstance.patch(`${BASE}/catdb/devices/${encodeURIComponent(deviceId)}`, body),
        "Failed to update CatDB device"
    );
}
