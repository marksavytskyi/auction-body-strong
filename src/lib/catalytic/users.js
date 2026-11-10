// Typed client for /users — role and account-active management. Every
// endpoint here is presumed OWNER/ADMIN-tier; the backend is the actual
// source of truth on exactly who can call what (verified live: WORKER
// gets 403 from GET /users). Never assume a role change succeeded beyond
// what the response confirms.

import { request, axiosInstance } from "./http";

export function listUsers({ includeDeleted = false } = {}) {
    return request(() => axiosInstance.get("/users", { params: includeDeleted ? { include_deleted: true } : {} }), "Failed to load users");
}

export function setUserRole(userId, role) {
    return request(() => axiosInstance.patch(`/users/${encodeURIComponent(userId)}/role`, { role }), "Failed to change role");
}

export function setUserActive(userId, isActive) {
    return request(() => axiosInstance.patch(`/users/${encodeURIComponent(userId)}/active`, { is_active: isActive }), "Failed to update account status");
}

// OWNER only. Keeps the account and everything it recorded; ends its access.
export function deleteUser(userId) {
    return request(() => axiosInstance.delete(`/users/${encodeURIComponent(userId)}`), "Failed to delete user");
}

// OWNER only. The user comes back deactivated.
export function restoreUser(userId) {
    return request(() => axiosInstance.post(`/users/${encodeURIComponent(userId)}/restore`), "Failed to restore user");
}

// OWNER only. Who changed which account, newest first.
export function listUserEvents({ userId, limit = 30 } = {}) {
    return request(() => axiosInstance.get("/users/events", { params: { limit, ...(userId ? { user_id: userId } : {}) } }), "Failed to load recent changes");
}
