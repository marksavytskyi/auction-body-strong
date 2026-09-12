// Typed client for the moderation queue. Every endpoint here 403s for the
// WORKER role (verified live) — gate any UI that calls these behind an
// elevated role, and still handle a 403 gracefully since role names beyond
// WORKER haven't all been enumerated.

import { request, axiosInstance } from "./http";

const BASE = "/moderation/captures";

export function listQueue(params = {}) {
    return request(() => axiosInstance.get(BASE, { params }), "Failed to load moderation queue");
}

export function getCaptureDetail(id) {
    return request(() => axiosInstance.get(`${BASE}/${encodeURIComponent(id)}`), "Failed to load capture");
}

// ApproveRequest: { moderator_notes?, year?, make?, model?, engine?,
// catalyst_overrides?: [{ catalyst_capture_id, position_code?, physical_code_raw? }] }
// Only include fields the moderator actually changed.
export function approveCapture(id, payload = {}) {
    return request(() => axiosInstance.post(`${BASE}/${encodeURIComponent(id)}/approve`, payload), "Failed to approve capture");
}

// RejectRequest requires a non-empty `reason`.
export function rejectCapture(id, reason, moderatorNotes = "") {
    return request(
        () => axiosInstance.post(`${BASE}/${encodeURIComponent(id)}/reject`, { reason, moderator_notes: moderatorNotes }),
        "Failed to reject capture"
    );
}

export function getReviewLog(id) {
    return request(() => axiosInstance.get(`${BASE}/${encodeURIComponent(id)}/review-log`), "Failed to load review log");
}
