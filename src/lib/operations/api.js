// Typed client for /operations/* — matches app/operations/router.py
// exactly (backend commit 50e2d2f). OWNER/ADMIN only; the backend is the
// real enforcement boundary (require_roles(ADMIN_ROLES) on every route),
// this client never decides authorization itself.
//
// Deliberately thin: every function maps 1:1 to one backend endpoint,
// with the exact query/body shape that endpoint accepts. No endpoint is
// invented — if UI-1 needs something not listed here (CSV export, a
// batch-level financial summary, per-leg progress counts), it does not
// exist on the backend yet; see the UI-1 final report's "missing
// backend contracts" section.
//
// Reuses the existing generic request()/axiosInstance from
// ./catalytic/http.js (already proxies via /api, attaches the bearer
// token, and handles 401 — see that module) rather than building a
// second HTTP layer.

import { request, axiosInstance } from "@/lib/catalytic/http";

const BASE = "/operations";

// ─── batches ────────────────────────────────────────────────────────────

export function uploadOperationsBatch(file, options = {}) {
    const form = new FormData();
    form.append("file", file);
    const params = {};
    if (options.defaultScrapPercentage !== undefined) params.default_scrap_percentage = options.defaultScrapPercentage;
    if (options.defaultScrapRateUsdPerLb !== undefined) params.default_scrap_rate_usd_per_lb = options.defaultScrapRateUsdPerLb;
    if (options.defaultCatsSourcePolicy !== undefined) params.default_cats_source_policy = options.defaultCatsSourcePolicy;
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

// ─── cheap, backend-aggregated status counts (no CatDB/export endpoint
// exists — see UI-1 report) — reads `total` from a limit=1 filtered
// query per overall_status bucket, never fetches full vehicle rows just
// to produce a count. ──────────────────────────────────────────────────

export async function getOperationsBatchOverallStatusCounts(batchId, statuses) {
    const results = await Promise.all(
        statuses.map((status) =>
            listOperationsBatchVehicles(batchId, { limit: 1, offset: 0, status }).then((r) => [status, r?.total ?? 0])
        )
    );
    return Object.fromEntries(results);
}
