// Shared request helper for every catalytic-module API client (lookup,
// worker captures, moderation, users). All calls go through the existing
// axios instance, which already proxies via /api -> Next.js catch-all
// route -> real backend, and already attaches the Bearer token + handles
// 401 redirects.

import axiosInstance from "@/utils/axios";

// Renders one FastAPI validation-error item ({loc, msg, type}) as a
// single readable line, e.g. "body.confirm: Input should be a valid
// boolean". Falls back to a safe stringification for anything that
// isn't that exact shape, so a malformed/unexpected array entry can
// never leak a raw object into the final message.
function formatValidationItem(item) {
    if (item && typeof item === "object" && typeof item.msg === "string") {
        const loc = Array.isArray(item.loc) ? item.loc.join(".") : "";
        return loc ? `${loc}: ${item.msg}` : item.msg;
    }
    if (typeof item === "string") return item;
    try {
        return JSON.stringify(item);
    } catch {
        return String(item);
    }
}

// Phase I-B (Phase H audit finding M2): a FastAPI 422 response's
// `detail` is an ARRAY of validation-error objects, never a string —
// e.g. [{"loc": ["body", "confirm"], "msg": "Input should be a valid
// boolean", "type": "bool_type"}]. The previous version of this
// function only ever handled `detail` as a string, so a 422 left
// CatalyticApiError.message holding that raw array — safe nowhere a
// caller might render it directly (React throws on a bare array/object
// child; even a template string just stringifies to something useless
// like "[object Object]").
//
// Every other detail shape this app's own backends actually return
// (a plain string from HTTPException(detail="..."), or no detail at
// all) behaves EXACTLY as before — this only adds a new branch for the
// array case and a safe fallback for anything neither a string nor a
// recognized array, never changes what a normal string detail/message
// resolves to. Used by every catalytic-module API client (lookup,
// worker captures, moderation, users, Operations) via request() below,
// so this fix benefits all of them, not just Operations.
function extractErrorMessage(error, fallback) {
    const detail = error?.response?.data?.detail;
    if (typeof detail === "string" && detail) return detail;
    if (Array.isArray(detail) && detail.length > 0) {
        return detail.map(formatValidationItem).filter(Boolean).join("; ") || fallback;
    }

    const message = error?.response?.data?.message;
    if (typeof message === "string" && message) return message;

    // Any other `detail`/`message` shape (a plain object, a number,
    // etc.) is unexpected and never returned raw — never a stack trace
    // or internal error object exposed to the UI, just the generic
    // axios/fallback message instead.
    if (typeof error?.message === "string" && error.message) return error.message;
    return fallback;
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
