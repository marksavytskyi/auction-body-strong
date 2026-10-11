// Typed client for /copart-import/* — Copart CSV import of full-VIN
// vehicles, verified live against production. Admin/Owner only (backend
// enforces this; see app/copart_import/router.py require_roles(ADMIN_ROLES)
// on the real backend).
//
// Upload never queues anything to CatDB by itself — see catdbBatch.js for
// the separate, explicit batch-creation step that does.

import { request, axiosInstance } from "./http";

const BASE = "/copart-import";

export function uploadImport(file) {
    const form = new FormData();
    form.append("file", file);
    return request(
        () => axiosInstance.post(`${BASE}/upload`, form, { headers: { "Content-Type": "multipart/form-data" } }),
        "Failed to upload Copart CSV"
    );
}

export function listImports(limit = 100) {
    return request(() => axiosInstance.get(`${BASE}/imports`, { params: { limit } }), "Failed to load Copart imports");
}

export function getImport(id) {
    return request(() => axiosInstance.get(`${BASE}/imports/${encodeURIComponent(id)}`), "Failed to load Copart import");
}

export function listVehicles(importId, { limit = 1000, offset = 0 } = {}) {
    return request(
        () => axiosInstance.get(`${BASE}/imports/${encodeURIComponent(importId)}/vehicles`, { params: { limit, offset } }),
        "Failed to load Copart import vehicles"
    );
}

export function getVehicle(vehicleId) {
    return request(() => axiosInstance.get(`${BASE}/vehicles/${encodeURIComponent(vehicleId)}`), "Failed to load vehicle");
}

// Kept for completeness / single-vehicle admin tools, but the operational
// flow this module was built for always queues through a CatDB batch (see
// catdbBatch.js) so a VIN never gets submitted one click at a time.
export function queueVehicleForCatdb(vehicleId) {
    return request(
        () => axiosInstance.post(`${BASE}/vehicles/${encodeURIComponent(vehicleId)}/queue-catdb`),
        "Failed to queue vehicle for CatDB"
    );
}
