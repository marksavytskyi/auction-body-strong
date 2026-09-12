// Shared request helper for every catalytic-module API client (lookup,
// worker captures, moderation, users). All calls go through the existing
// axios instance, which already proxies via /api -> Next.js catch-all
// route -> real backend, and already attaches the Bearer token + handles
// 401 redirects.

import axiosInstance from "@/utils/axios";

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

export async function request(fn, fallbackMessage) {
    try {
        const res = await fn();
        return res.data;
    } catch (error) {
        const status = error?.response?.status;
        throw new CatalyticApiError(extractErrorMessage(error, fallbackMessage), { status, cause: error });
    }
}

export { axiosInstance };
