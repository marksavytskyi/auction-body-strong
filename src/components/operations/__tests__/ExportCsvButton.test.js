import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import ExportCsvButton from "../ExportCsvButton";
import { downloadOperationsBatchExportCsv } from "@/lib/operations/api";

vi.mock("@/lib/operations/api", () => ({
    downloadOperationsBatchExportCsv: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
    default: { success: vi.fn(), error: vi.fn() },
}));

describe("ExportCsvButton", () => {
    let createObjectURLSpy;
    let revokeObjectURLSpy;
    let clickSpy;

    beforeEach(() => {
        downloadOperationsBatchExportCsv.mockReset();
        createObjectURLSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fake-url");
        revokeObjectURLSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
        clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    });

    afterEach(() => {
        createObjectURLSpy.mockRestore();
        revokeObjectURLSpy.mockRestore();
        clickSpy.mockRestore();
    });

    it("downloads the backend-generated blob under the backend-provided filename on success", async () => {
        const blob = new Blob(["vin,year\n1HGCM,2020\n"], { type: "text/csv" });
        downloadOperationsBatchExportCsv.mockResolvedValue({ blob, filename: "operations_batch_7_export.csv" });

        render(<ExportCsvButton batchId={7} />);
        fireEvent.click(screen.getByRole("button", { name: /export csv/i }));

        await waitFor(() => expect(downloadOperationsBatchExportCsv).toHaveBeenCalledWith(7));
        await waitFor(() => expect(clickSpy).toHaveBeenCalled());
        expect(createObjectURLSpy).toHaveBeenCalledWith(blob);
        expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:fake-url");
    });

    it("shows an error toast and never throws when the download fails", async () => {
        const toast = (await import("react-hot-toast")).default;
        downloadOperationsBatchExportCsv.mockRejectedValue(new Error("Batch not found"));

        render(<ExportCsvButton batchId={999} />);
        fireEvent.click(screen.getByRole("button", { name: /export csv/i }));

        await waitFor(() => expect(toast.error).toHaveBeenCalled());
        expect(clickSpy).not.toHaveBeenCalled();
    });

    it("shows a loading state while the download is in flight", async () => {
        let resolveDownload;
        downloadOperationsBatchExportCsv.mockImplementation(() => new Promise((resolve) => { resolveDownload = resolve; }));

        render(<ExportCsvButton batchId={7} />);
        const button = screen.getByRole("button", { name: /export csv/i });
        fireEvent.click(button);

        await waitFor(() => expect(button).toBeDisabled());
        resolveDownload({ blob: new Blob(["x"]), filename: "x.csv" });
        await waitFor(() => expect(button).not.toBeDisabled());
    });

    it("never logs CSV contents when triggering a download", async () => {
        const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        const blob = new Blob(["vin,secret\n1,abc\n"], { type: "text/csv" });
        downloadOperationsBatchExportCsv.mockResolvedValue({ blob, filename: "export.csv" });

        render(<ExportCsvButton batchId={7} />);
        fireEvent.click(screen.getByRole("button", { name: /export csv/i }));
        await waitFor(() => expect(clickSpy).toHaveBeenCalled());

        expect(logSpy).not.toHaveBeenCalled();
        logSpy.mockRestore();
    });
});
