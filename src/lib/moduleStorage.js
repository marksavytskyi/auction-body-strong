// Lightweight persistence for "which module did the user use last" so the
// app can offer a sensible default next time. URL routing is always the
// source of truth for what's currently active — this is only a convenience.

const ACTIVE_MODULE_KEY = "app:active-module";

export function getLastModule() {
    if (typeof window === "undefined") return "parts";
    return window.localStorage.getItem(ACTIVE_MODULE_KEY) || "parts";
}

export function setLastModule(moduleId) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(ACTIVE_MODULE_KEY, moduleId);
}
