import "@testing-library/jest-dom/vitest";

// jsdom doesn't implement createObjectURL/revokeObjectURL — the capture
// detail page uses it for local photo-preview thumbnails before upload.
if (typeof window !== "undefined" && !window.URL.createObjectURL) {
    window.URL.createObjectURL = () => "blob:mock-preview-url";
    window.URL.revokeObjectURL = () => {};
}

// jsdom doesn't implement scrollIntoView at all — used to bring an
// incomplete catalyst into view when a blocked submit attempt happens.
if (typeof window !== "undefined" && !window.HTMLElement.prototype.scrollIntoView) {
    window.HTMLElement.prototype.scrollIntoView = () => {};
}
