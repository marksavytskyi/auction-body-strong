// Client-side RBAC hints only — the backend enforces every one of these
// boundaries independently. This module exists purely to route each role
// to a sensible home and avoid showing nav/pages that will always 403.
// Never rely on this for security: every page still handles a 403 from
// the backend gracefully on its own, and WORKER-facing pages must never
// initiate admin-only API calls in the first place.

export const ROLES = {
    OWNER: "OWNER",
    ADMIN: "ADMIN",
    MODERATOR: "MODERATOR",
    WORKER: "WORKER",
};

function normalize(role) {
    return String(role || "").toUpperCase();
}

export function isWorkerRole(role) {
    return normalize(role) === ROLES.WORKER;
}

export function isModeratorRole(role) {
    return normalize(role) === ROLES.MODERATOR;
}

export function isAdminRole(role) {
    return normalize(role) === ROLES.ADMIN;
}

export function isOwnerRole(role) {
    return normalize(role) === ROLES.OWNER;
}

// Anything above WORKER — used sparingly, prefer the specific checks above
// wherever a screen's real requirement is narrower than "not a worker".
export function isElevatedRole(role) {
    return Boolean(role) && !isWorkerRole(role);
}

// Admin-tier tools (Overview, Users & Roles, Workers, CatDB, Corrections).
// MODERATOR gets a deliberately narrower slice — see rbac note in CatsNav.
export function isAdminTierRole(role) {
    return isOwnerRole(role) || isAdminRole(role);
}

export function homeRouteForRole(role) {
    if (isWorkerRole(role)) return "/worker";
    if (isModeratorRole(role)) return "/cats/moderation";
    if (isAdminTierRole(role)) return "/cats/admin";
    // Role not resolved yet, or unrecognized — land somewhere that still
    // works for everyone rather than guessing at admin tools.
    return "/cats";
}
