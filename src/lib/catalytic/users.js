// Typed client for /users — role and account-active management. Every
// endpoint here is presumed OWNER/ADMIN-tier; the backend is the actual
// source of truth on exactly who can call what (verified live: WORKER
// gets 403 from GET /users). Never assume a role change succeeded beyond
// what the response confirms.

import { request, axiosInstance } from "./http";

export function listUsers() {
    return request(() => axiosInstance.get("/users"), "Failed to load users");
}

export function setUserRole(userId, role) {
    return request(() => axiosInstance.patch(`/users/${encodeURIComponent(userId)}/role`, { role }), "Failed to change role");
}

export function setUserActive(userId, isActive) {
    return request(() => axiosInstance.patch(`/users/${encodeURIComponent(userId)}/active`, { is_active: isActive }), "Failed to update account status");
}
