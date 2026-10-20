import { describe, expect, it, vi, beforeEach } from "vitest";

import {
    getOperationsBatchFinancialSummary, getOperationsBatchProgress, downloadOperationsBatchExportCsv,
    previewOperationsCatdbSearches, approveOperationsCatdbSearches, listOperationsCatdbApprovals, reconcileOperationsCatdbResults,
} from "../api";
import { axiosInstance, CatalyticApiError } from "@/lib/catalytic/http";

vi.mock("@/lib/catalytic/http", () => {
    class FakeCatalyticApiError extends Error {
        constructor(message, { status, cause } = {}) {
            super(message);
            this.name = "CatalyticApiError";
            this.status = status;
            this.cause = cause;
        }
    }
    return {
        axiosInstance: { get: vi.fn(), post: vi.fn() },
        request: async (fn, fallbackMessage) => {
            try {
                const res = await fn();
                return res.data;
            } catch (error) {
                throw new FakeCatalyticApiError(error?.response?.data?.detail || fallbackMessage, { status: error?.response?.status, cause: error });
            }
        },
        CatalyticApiError: FakeCatalyticApiError,
    };
});

describe("getOperationsBatchFinancialSummary", () => {
    beforeEach(() => { axiosInstance.get.mockReset(); });

    it("calls the exact financial-summary endpoint and returns the backend's response body verbatim", async () => {
        const body = { operations_batch_id: 7, complete_recovery_total: "100.00", partial_known_components_subtotal: null };
        axiosInstance.get.mockResolvedValue({ data: body });

        const result = await getOperationsBatchFinancialSummary(7);

        expect(axiosInstance.get).toHaveBeenCalledWith("/operations/batches/7/financial-summary");
        expect(result).toBe(body);
    });
});

describe("getOperationsBatchProgress", () => {
    beforeEach(() => { axiosInstance.get.mockReset(); });

    it("calls the exact progress endpoint", async () => {
        const body = { operations_batch_id: 7, parts: {}, ourdb: {}, weight: {} };
        axiosInstance.get.mockResolvedValue({ data: body });

        const result = await getOperationsBatchProgress(7);

        expect(axiosInstance.get).toHaveBeenCalledWith("/operations/batches/7/progress");
        expect(result).toBe(body);
    });
});

describe("downloadOperationsBatchExportCsv", () => {
    beforeEach(() => { axiosInstance.get.mockReset(); });

    it("calls the export endpoint with responseType blob and extracts the filename from Content-Disposition", async () => {
        const blob = new Blob(["vin,year\n"], { type: "text/csv" });
        axiosInstance.get.mockResolvedValue({
            data: blob,
            headers: { "content-disposition": 'attachment; filename="operations_batch_7_export.csv"' },
        });

        const result = await downloadOperationsBatchExportCsv(7);

        expect(axiosInstance.get).toHaveBeenCalledWith("/operations/batches/7/export", { responseType: "blob" });
        expect(result.blob).toBe(blob);
        expect(result.filename).toBe("operations_batch_7_export.csv");
    });

    it("falls back to a default filename when Content-Disposition is absent", async () => {
        const blob = new Blob(["vin\n"], { type: "text/csv" });
        axiosInstance.get.mockResolvedValue({ data: blob, headers: {} });

        const result = await downloadOperationsBatchExportCsv(42);

        expect(result.filename).toBe("operations_batch_42_export.csv");
    });

    it("extracts the real error message when the error body arrives as a Blob (responseType: blob)", async () => {
        const errorBlob = new Blob([JSON.stringify({ detail: "Batch not found" })], { type: "application/json" });
        axiosInstance.get.mockRejectedValue({ response: { status: 404, data: errorBlob } });

        await expect(downloadOperationsBatchExportCsv(999)).rejects.toMatchObject({ message: "Batch not found" });
    });

    it("falls back to a generic message when the Blob error body isn't valid JSON", async () => {
        const errorBlob = new Blob(["not json"], { type: "text/plain" });
        axiosInstance.get.mockRejectedValue({ response: { status: 500, data: errorBlob } });

        await expect(downloadOperationsBatchExportCsv(1)).rejects.toMatchObject({ message: "Failed to export batch CSV" });
    });

    it("never logs CSV contents on success", async () => {
        const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        const blob = new Blob(["vin,secret-looking-data\n1,abc\n"], { type: "text/csv" });
        axiosInstance.get.mockResolvedValue({ data: blob, headers: {} });

        await downloadOperationsBatchExportCsv(7);

        expect(logSpy).not.toHaveBeenCalled();
        logSpy.mockRestore();
    });
});

describe("previewOperationsCatdbSearches", () => {
    beforeEach(() => { axiosInstance.get.mockReset(); });

    it("calls the exact preview endpoint via GET, never a write", async () => {
        const body = { operations_batch_id: 7, fingerprint: "abc123", entries: [] };
        axiosInstance.get.mockResolvedValue({ data: body });

        const result = await previewOperationsCatdbSearches(7);

        expect(axiosInstance.get).toHaveBeenCalledWith("/operations/batches/7/catdb/preview");
        expect(result).toBe(body);
    });
});

describe("approveOperationsCatdbSearches", () => {
    beforeEach(() => { axiosInstance.post.mockReset(); });

    it("forwards preview_fingerprint/max_new_searches/confirm exactly as named by the backend schema", async () => {
        const body = { id: 1, status: "COMPLETE" };
        axiosInstance.post.mockResolvedValue({ data: body });

        const result = await approveOperationsCatdbSearches(7, { previewFingerprint: "fp-1", maxNewSearches: 5, confirm: true });

        expect(axiosInstance.post).toHaveBeenCalledWith("/operations/batches/7/catdb/approve", {
            preview_fingerprint: "fp-1", max_new_searches: 5, confirm: true,
        });
        expect(result).toBe(body);
    });

    it("never defaults confirm to true itself — forwards exactly what the caller passed", async () => {
        axiosInstance.post.mockResolvedValue({ data: {} });

        await approveOperationsCatdbSearches(7, { previewFingerprint: "fp-1", maxNewSearches: 5, confirm: false });

        expect(axiosInstance.post).toHaveBeenCalledWith("/operations/batches/7/catdb/approve", expect.objectContaining({ confirm: false }));
    });

    it("surfaces a 409 (stale fingerprint / approval conflict) with the backend's real status", async () => {
        axiosInstance.post.mockRejectedValue({ response: { status: 409, data: { detail: "stale preview fingerprint" } } });

        await expect(approveOperationsCatdbSearches(7, { previewFingerprint: "stale", maxNewSearches: 5, confirm: true }))
            .rejects.toMatchObject({ status: 409, message: "stale preview fingerprint" });
    });
});

describe("listOperationsCatdbApprovals", () => {
    beforeEach(() => { axiosInstance.get.mockReset(); });

    it("calls the approvals endpoint with limit/offset params, defaulting to a page size of 10", async () => {
        const body = { items: [], total: 0, limit: 10, offset: 0 };
        axiosInstance.get.mockResolvedValue({ data: body });

        const result = await listOperationsCatdbApprovals(7);

        expect(axiosInstance.get).toHaveBeenCalledWith("/operations/batches/7/catdb/approvals", { params: { limit: 10, offset: 0 } });
        expect(result).toBe(body);
    });

    it("forwards an explicit limit/offset for pagination", async () => {
        axiosInstance.get.mockResolvedValue({ data: { items: [], total: 30, limit: 10, offset: 10 } });

        await listOperationsCatdbApprovals(7, { limit: 10, offset: 10 });

        expect(axiosInstance.get).toHaveBeenCalledWith("/operations/batches/7/catdb/approvals", { params: { limit: 10, offset: 10 } });
    });
});

describe("reconcileOperationsCatdbResults", () => {
    beforeEach(() => { axiosInstance.post.mockReset(); });

    it("calls the exact reconcile endpoint with no body", async () => {
        const body = { operations_batch_id: 7, vehicles_examined: 3, done_count: 1, no_result_count: 1, review_required_count: 0, still_in_flight_count: 1, unchanged_count: 0 };
        axiosInstance.post.mockResolvedValue({ data: body });

        const result = await reconcileOperationsCatdbResults(7);

        expect(axiosInstance.post).toHaveBeenCalledWith("/operations/batches/7/catdb/reconcile");
        expect(result).toBe(body);
    });
});
