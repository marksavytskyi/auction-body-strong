// Typed request layer for the CATS (catalytic converter) backend module.
// All calls go through the existing axios instance, which already proxies
// via /api -> Next.js catch-all route -> real backend, and already attaches
// the Bearer token + handles 401 redirects. Do not call fetch() directly
// from page components — extend this file instead.

import axiosInstance from "@/utils/axios";

const BASE = "/catalytic";

function extractErrorMessage(error, fallback) {
    return (
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        error?.message ||
        fallback
    );
}

export class CatalyticApiError extends Error {
    constructor(message, { status, cause } = {}) {
        super(message);
        this.name = "CatalyticApiError";
        this.status = status;
        this.cause = cause;
    }
}

async function request(fn, fallbackMessage) {
    try {
        const res = await fn();
        return res.data;
    } catch (error) {
        const status = error?.response?.status;
        throw new CatalyticApiError(extractErrorMessage(error, fallbackMessage), { status, cause: error });
    }
}

// ---- Vehicle lookup ---------------------------------------------------

export function lookupVehicle(payload) {
    const body = {
        year: payload.year ?? null,
        make: payload.make ?? null,
        model: payload.model ?? null,
        engine: payload.engine ?? null,
        vin: payload.vin ? payload.vin : null,
    };
    return request(() => axiosInstance.post(`${BASE}/lookup`, body), "Vehicle lookup failed");
}

// ---- Observations -------------------------------------------------------

export function listObservations(params = {}) {
    return request(() => axiosInstance.get(`${BASE}/observations`, { params }), "Failed to load observations");
}

export function createObservation(payload) {
    return request(() => axiosInstance.post(`${BASE}/observations`, payload), "Failed to record observation");
}

// ---- Sales ----------------------------------------------------------------

export function listSales(params = {}) {
    return request(() => axiosInstance.get(`${BASE}/sales`, { params }), "Failed to load sales history");
}

export function createSale(payload) {
    return request(() => axiosInstance.post(`${BASE}/sales`, payload), "Failed to record sale");
}

// ---- Converters -------------------------------------------------------
// GET /catalytic/converters/search takes a required `q` (not `code`).

export function searchConverters(query, params = {}) {
    return request(() => axiosInstance.get(`${BASE}/converters/search`, { params: { q: query, ...params } }), "Converter search failed");
}

export function getConverter(id) {
    return request(() => axiosInstance.get(`${BASE}/converters/${encodeURIComponent(id)}`), "Failed to load converter");
}

// ---- Batch CSV -----------------------------------------------------------
// Note: the production API exposes no /catalytic/batch/{id}/download route —
// do not call one. Results are read via getBatchRows only.

export function createBatch(file) {
    const form = new FormData();
    form.append("file", file);
    return request(
        () => axiosInstance.post(`${BASE}/batch`, form, { headers: { "Content-Type": "multipart/form-data" } }),
        "Batch upload failed"
    );
}

export function getBatch(id) {
    return request(() => axiosInstance.get(`${BASE}/batch/${encodeURIComponent(id)}`), "Failed to load batch status");
}

export function getBatchRows(id, params = {}) {
    return request(() => axiosInstance.get(`${BASE}/batch/${encodeURIComponent(id)}/rows`, { params }), "Failed to load batch rows");
}

// ---- Vehicle keys / positions / candidates / overrides (admin) -----------
// PATCH vehicle-keys/{id} and PATCH positions/{id} both take an
// OverrideRequest: { field, value, reason }. `reason` has minLength 1.

export function listVehicleKeys(params = {}) {
    return request(() => axiosInstance.get(`${BASE}/vehicle-keys`, { params }), "Failed to load vehicle keys");
}

export function getVehicleKey(id) {
    return request(() => axiosInstance.get(`${BASE}/vehicle-keys/${encodeURIComponent(id)}`), "Failed to load vehicle key");
}

export function overrideVehicleKey(id, { field, value, reason }) {
    return request(() => axiosInstance.patch(`${BASE}/vehicle-keys/${encodeURIComponent(id)}`, { field, value, reason }), "Failed to update vehicle key");
}

export function overridePosition(id, { field, value, reason }) {
    return request(() => axiosInstance.patch(`${BASE}/positions/${encodeURIComponent(id)}`, { field, value, reason }), "Failed to update position");
}

export function rejectCandidate(id, reason) {
    return request(() => axiosInstance.post(`${BASE}/candidates/${encodeURIComponent(id)}/reject`, { reason }), "Failed to reject candidate");
}

export function listOverrideLog(params = {}) {
    return request(() => axiosInstance.get(`${BASE}/override-log`, { params }), "Failed to load override log");
}
