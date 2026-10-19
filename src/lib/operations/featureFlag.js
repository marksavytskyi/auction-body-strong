// Frontend-only feature flag for the Operations module (UI-1). Distinct
// from the backend's own OPERATIONS_ENABLED (app/operations/config.py) —
// both must be enabled independently before Operations is actually
// reachable end-to-end; this one only controls whether this frontend
// exposes any Operations UI at all. Defaults to disabled when unset.
export function isOperationsUiEnabled() {
    return process.env.NEXT_PUBLIC_OPERATIONS_ENABLED === "true";
}
