// Carries the most recent vehicle lookup (query + normalized result) between
// Cats pages within the same tab, e.g. Lookup -> Observations, so the worker
// doesn't have to re-enter year/make/model/engine/VIN every time. This is a
// convenience only — every page can also perform its own fresh lookup.

const KEY = "cats:last-lookup";

export function setLastLookup(query, raw) {
    if (typeof window === "undefined") return;
    try {
        window.sessionStorage.setItem(KEY, JSON.stringify({ query, raw, ts: Date.now() }));
    } catch {
        // storage may be unavailable (private mode, quota) — safe to ignore
    }
}

export function getLastLookup() {
    if (typeof window === "undefined") return null;
    try {
        const raw = window.sessionStorage.getItem(KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}
