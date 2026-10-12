// Typed client for the worker capture workflow, verified live against
// production: POST /worker/captures -> DRAFT, add catalysts while DRAFT,
// POST .../submit -> PENDING_REVIEW. State-transition rules confirmed live:
//   - edit/add-catalyst/delete capture: only while status === "DRAFT"
//   - POST .../reopen: only valid from status === "REJECTED" (brings it
//     back to DRAFT) — calling it on a PENDING_REVIEW capture 400s
//   - DELETE capture: only while status === "DRAFT"
// Approval/rejection itself happens via moderation.js (elevated roles).

import { request, axiosInstance, CatalyticApiError } from "./http";

const BASE = "/worker/captures";

export const CAPTURE_STATUS = {
    DRAFT: "DRAFT",
    PENDING_REVIEW: "PENDING_REVIEW",
    APPROVED: "APPROVED",
    REJECTED: "REJECTED",
};

export function listCaptures(params = {}) {
    return request(() => axiosInstance.get(BASE, { params }), "Failed to load captures");
}

export function getCapture(id) {
    return request(() => axiosInstance.get(`${BASE}/${encodeURIComponent(id)}`), "Failed to load capture");
}

export function createCapture(payload) {
    return request(() => axiosInstance.post(BASE, payload), "Failed to create capture");
}

export function updateCapture(id, payload) {
    return request(() => axiosInstance.patch(`${BASE}/${encodeURIComponent(id)}`, payload), "Failed to update capture");
}

export function deleteCapture(id) {
    return request(() => axiosInstance.delete(`${BASE}/${encodeURIComponent(id)}`), "Failed to delete capture");
}

export function addCatalyst(captureId, payload) {
    return request(() => axiosInstance.post(`${BASE}/${encodeURIComponent(captureId)}/catalysts`, payload), "Failed to add catalyst");
}

export function updateCatalyst(captureId, catalystId, payload) {
    return request(
        () => axiosInstance.patch(`${BASE}/${encodeURIComponent(captureId)}/catalysts/${encodeURIComponent(catalystId)}`, payload),
        "Failed to update catalyst"
    );
}

export function deleteCatalyst(captureId, catalystId) {
    return request(
        () => axiosInstance.delete(`${BASE}/${encodeURIComponent(captureId)}/catalysts/${encodeURIComponent(catalystId)}`),
        "Failed to delete catalyst"
    );
}

// Real presigned-upload contract, verified live: the backend never
// accepts raw bytes itself. Step 1 asks it to describe an upload (it picks
// the storage key) and returns a short-lived presigned PUT URL; step 2 is
// a direct browser PUT to that URL, bypassing our own server entirely.
//
// Verified live: as of now this 503s in production with
// "Object storage is not configured — R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/
// R2_SECRET_ACCESS_KEY/R2_BUCKET_NAME must be set." — the endpoint and
// contract are real, only the R2 environment configuration is missing.
// Surface that 503 as a clear, distinct error rather than a generic one.
export function requestPhotoUploadUrl(captureId, catalystId, { filename, mimeType, sizeBytes }) {
    return request(
        () =>
            axiosInstance.post(`${BASE}/${encodeURIComponent(captureId)}/catalysts/${encodeURIComponent(catalystId)}/photos/upload-url`, {
                filename,
                mime_type: mimeType,
                size_bytes: sizeBytes,
            }),
        "Failed to prepare photo upload"
    );
}

// Direct PUT to the presigned URL — deliberately NOT routed through
// axiosInstance/the Next.js proxy: this goes straight to object storage,
// not to our backend, and must not carry an Authorization header. Uses
// XMLHttpRequest (not fetch) so real byte-level upload progress can be
// reported — fetch has no upload-progress event.
export function uploadPhotoBytes(uploadUrl, file, onProgress) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl, true);
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");

        if (xhr.upload && onProgress) {
            xhr.upload.onprogress = (evt) => {
                if (evt.lengthComputable) onProgress(Math.round((evt.loaded / evt.total) * 100));
            };
        }

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new CatalyticApiError(`Photo upload failed (${xhr.status})`, { status: xhr.status }));
        };
        xhr.onerror = () => reject(new CatalyticApiError("Photo upload failed — network error"));

        xhr.send(file);
    });
}

// Orchestrates the full two-step flow and returns the photo_id the
// backend already knows about (it's created at request-upload-url time,
// before the bytes even land in storage).
export async function uploadCatalystPhoto(captureId, catalystId, file, { onProgress } = {}) {
    onProgress?.(0);
    const { photo_id: photoId, upload_url: uploadUrl } = await requestPhotoUploadUrl(captureId, catalystId, {
        filename: file.name || "photo.jpg",
        mimeType: file.type || "image/jpeg",
        sizeBytes: file.size,
    });
    await uploadPhotoBytes(uploadUrl, file, onProgress);
    onProgress?.(100);
    return photoId;
}

export function deletePhoto(captureId, catalystId, photoId) {
    return request(
        () => axiosInstance.delete(`${BASE}/${encodeURIComponent(captureId)}/catalysts/${encodeURIComponent(catalystId)}/photos/${encodeURIComponent(photoId)}`),
        "Failed to delete photo"
    );
}

// Mirrors the backend's own submit-time rule (app/catalytic/worker/
// services.py::submit_capture, added for production readiness): a
// catalyst must have EITHER a non-blank stamped code OR an explicit
// code_unreadable=true. Kept as a pure function so both the catalyst card
// (per-catalyst warning) and the submit checklist (capture-wide gate) use
// the exact same rule instead of two definitions drifting apart.
export function catalystHasCodeInfo(catalyst) {
    return Boolean(catalyst?.code_unreadable) || Boolean((catalyst?.physical_code_raw || "").trim());
}

// This UI's own operational policy (not a backend rule): every catalyst
// needs at least one successfully uploaded photo before the capture can
// be submitted — true even when code_unreadable is set. `pendingPhotosByCatalystId`
// covers photos that finished uploading in this session but haven't
// round-tripped into the capture object yet (see the capture detail
// page's local pending-upload state).
export function catalystHasPhoto(catalyst, pendingPhotos = []) {
    return (catalyst?.photos || []).length > 0 || pendingPhotos.some((p) => p.status === "done");
}

export function catalystIsReady(catalyst, pendingPhotos = []) {
    return catalystHasCodeInfo(catalyst) && catalystHasPhoto(catalyst, pendingPhotos);
}

// The full submit checklist for a capture: at least one catalyst, and
// every catalyst individually ready. Never calls the submit endpoint by
// itself — callers check this first and only call submitCapture() when
// it's true.
export function captureIsReadyToSubmit(capture, pendingPhotosByCatalystId = {}) {
    const catalysts = capture?.catalysts || [];
    if (catalysts.length === 0) return false;
    return catalysts.every((c) => catalystIsReady(c, pendingPhotosByCatalystId[c.id] || []));
}

// First catalyst (in display order) that's missing something, for
// scrolling/focusing the worker to it when a submit attempt is blocked.
export function firstIncompleteCatalyst(capture, pendingPhotosByCatalystId = {}) {
    const catalysts = capture?.catalysts || [];
    return catalysts.find((c) => !catalystIsReady(c, pendingPhotosByCatalystId[c.id] || [])) || null;
}

export function submitCapture(id) {
    return request(() => axiosInstance.post(`${BASE}/${encodeURIComponent(id)}/submit`), "Failed to submit capture");
}

export function reopenCapture(id) {
    return request(() => axiosInstance.post(`${BASE}/${encodeURIComponent(id)}/reopen`), "Failed to reopen capture");
}
