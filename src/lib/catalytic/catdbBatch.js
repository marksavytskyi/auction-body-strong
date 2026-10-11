// Typed client for /catdb/admin/batches — strictly sequential CatDB VIN
// batch orchestration on top of the existing CatDB job queue, verified
// live against production. Admin/Owner only.
//
// IMPORTANT: POST .../start is the ONLY call in this whole module that can
// cause a real CatDB VIN search (and therefore spend CatDB lookup quota /
// wake the Android worker). create/list/get/pause/resume/cancel never do.
// Every call site in the UI that reaches startBatch must go through an
// explicit, deliberate confirmation step — see
// src/app/cats/admin/catdb-batches/*.

import { request, axiosInstance } from "./http";

const BASE = "/catdb/admin/batches";

// limit is required by the backend — there is no unlimited default and
// none should ever be synthesized here (see product spec: never offer
// "All N" / never default to the full import).
export function createBatch({ copartImportId, limit, noResultPolicy } = {}) {
    return request(
        () =>
            axiosInstance.post(BASE, {
                copart_import_id: copartImportId,
                limit,
                ...(noResultPolicy ? { no_result_policy: noResultPolicy } : {}),
            }),
        "Failed to create CatDB batch"
    );
}

export function listBatches({ copartImportId, limit = 100 } = {}) {
    return request(
        () => axiosInstance.get(BASE, { params: { copart_import_id: copartImportId, limit } }),
        "Failed to load CatDB batches"
    );
}

export function getBatch(id) {
    return request(() => axiosInstance.get(`${BASE}/${encodeURIComponent(id)}`), "Failed to load CatDB batch");
}

// The one call that can spend CatDB quota / wake the Android worker.
export function startBatch(id) {
    return request(() => axiosInstance.post(`${BASE}/${encodeURIComponent(id)}/start`), "Failed to start CatDB batch");
}

export function pauseBatch(id, reason) {
    return request(
        () => axiosInstance.post(`${BASE}/${encodeURIComponent(id)}/pause`, reason ? { reason } : {}),
        "Failed to pause CatDB batch"
    );
}

export function resumeBatch(id) {
    return request(() => axiosInstance.post(`${BASE}/${encodeURIComponent(id)}/resume`), "Failed to resume CatDB batch");
}

export function cancelBatch(id, reason) {
    return request(
        () => axiosInstance.post(`${BASE}/${encodeURIComponent(id)}/cancel`, reason ? { reason } : {}),
        "Failed to cancel CatDB batch"
    );
}

// Deliberate, small, backend-respecting preset — NOT derived from the
// import's vehicle count. The real cap lives server-side
// (CATDB_MAX_BATCH_SIZE, 10 as of this writing); the backend's own 400
// response is always the authority if it ever changes, these are just
// sane quick-picks for the UI.
export const BATCH_SIZE_PRESETS = [1, 3, 5, 10];
export const KNOWN_MAX_BATCH_SIZE = 10;
