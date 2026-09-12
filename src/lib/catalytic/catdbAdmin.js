// Typed client for /catdb/admin/* — the CatDB Android-automation control
// plane, verified live against production. Admin/Owner only.
//
// Note on naming: the backend's "worker" here means a CatDB Android
// automation device/machine, NOT the human WORKER role used elsewhere in
// this app. UI copy should say "CatDB machine" / "device" to avoid
// confusing the two concepts.
//
// /catdb/worker/* (heartbeat, jobs/claim, jobs/{id}/start|complete|renew-lease)
// is the machine-to-machine API the Android automation service calls
// directly — this frontend must never call it (per product direction: no
// Appium/ADB/Android automation logic in Next.js).

import { request, axiosInstance } from "./http";

const BASE = "/catdb/admin";

export function listJobs(params = {}) {
    return request(() => axiosInstance.get(`${BASE}/jobs`, { params }), "Failed to load CatDB jobs");
}

export function enqueueJob({ vin, priority = 0, maxAttempts = null, force = false }) {
    return request(
        () => axiosInstance.post(`${BASE}/jobs`, { vin, priority, max_attempts: maxAttempts, force }),
        "Failed to enqueue CatDB job"
    );
}

export function bulkEnqueueJobs(vins, priority = 0) {
    return request(() => axiosInstance.post(`${BASE}/jobs/bulk`, { vins, priority }), "Failed to enqueue CatDB jobs");
}

export function getJob(id) {
    return request(() => axiosInstance.get(`${BASE}/jobs/${encodeURIComponent(id)}`), "Failed to load CatDB job");
}

export function getLatestSnapshot(vin) {
    return request(() => axiosInstance.get(`${BASE}/snapshots/latest`, { params: { vin } }), "Failed to load CatDB snapshot");
}

export function getSnapshot(id) {
    return request(() => axiosInstance.get(`${BASE}/snapshots/${encodeURIComponent(id)}`), "Failed to load CatDB snapshot");
}

export function getStats() {
    return request(() => axiosInstance.get(`${BASE}/stats`), "Failed to load CatDB stats");
}

export function listMachines() {
    return request(() => axiosInstance.get(`${BASE}/workers`), "Failed to load CatDB machines");
}

// Returns { worker, token } — the token is shown exactly once (creation or
// rotation) and cannot be retrieved again.
export function createMachine(name) {
    return request(() => axiosInstance.post(`${BASE}/workers`, { name }), "Failed to create CatDB machine");
}

export function setMachineActive(id, isActive) {
    return request(() => axiosInstance.patch(`${BASE}/workers/${encodeURIComponent(id)}/active`, { is_active: isActive }), "Failed to update machine");
}

export function rotateMachineToken(id) {
    return request(() => axiosInstance.post(`${BASE}/workers/${encodeURIComponent(id)}/rotate-token`), "Failed to rotate machine token");
}
