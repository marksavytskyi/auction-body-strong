import { describe, expect, it, vi, beforeEach } from "vitest";

import { getOperationsBatchFinancialSummary, getOperationsBatchProgress, downloadOperationsBatchExportCsv } from "../api";
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
        axiosInstance: { get: vi.fn() },
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
