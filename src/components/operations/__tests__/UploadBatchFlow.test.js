import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import UploadBatchFlow from "../UploadBatchFlow";
import { uploadOperationsBatch } from "@/lib/operations/api";
import { CatalyticApiError } from "@/lib/catalytic/http";

vi.mock("@/lib/operations/api", () => ({
    uploadOperationsBatch: vi.fn(),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("react-hot-toast", () => ({
    default: { success: (...a) => toastSuccess(...a), error: (...a) => toastError(...a), loading: vi.fn(() => "toast-id") },
}));

function makeFile(name = "batch.csv", type = "text/csv") {
    return new File(["lot,vin\n1,1HGCM82633A000001"], name, { type });
}

describe("UploadBatchFlow", () => {
    beforeEach(() => {
        uploadOperationsBatch.mockReset();
        toastSuccess.mockClear();
        toastError.mockClear();
    });

    it("uploads the selected CSV and reports the created batch on success", async () => {
        uploadOperationsBatch.mockResolvedValue({ id: 42, total_vehicles: 7 });
        const onUploaded = vi.fn();
        render(<UploadBatchFlow onUploaded={onUploaded} />);

        const input = document.querySelector('input[type="file"]');
        fireEvent.change(input, { target: { files: [makeFile()] } });
        await screen.findByText("batch.csv");

        const uploadButton = screen.getByRole("button", { name: /upload/i });
        fireEvent.click(uploadButton);

        await waitFor(() => expect(onUploaded).toHaveBeenCalledWith({ id: 42, total_vehicles: 7 }));
        expect(toastSuccess).toHaveBeenCalled();
    });

    it("shows the backend's own validation error message on a failed upload and never navigates", async () => {
        uploadOperationsBatch.mockRejectedValue(new CatalyticApiError("Only .csv files are allowed", { status: 400 }));
        const onUploaded = vi.fn();
        render(<UploadBatchFlow onUploaded={onUploaded} />);

        const input = document.querySelector('input[type="file"]');
        fireEvent.change(input, { target: { files: [makeFile()] } });
        await screen.findByText("batch.csv");
        fireEvent.click(screen.getByRole("button", { name: /upload/i }));

        await waitFor(() => expect(toastError).toHaveBeenCalledWith("Only .csv files are allowed", expect.anything()));
        expect(onUploaded).not.toHaveBeenCalled();
    });

    it("rejects a non-csv file client-side before ever calling the upload endpoint", async () => {
        render(<UploadBatchFlow onUploaded={vi.fn()} />);
        const input = document.querySelector('input[type="file"]');
        fireEvent.change(input, { target: { files: [makeFile("not-a-csv.txt", "text/plain")] } });
        await waitFor(() => expect(toastError).toHaveBeenCalled());
        expect(uploadOperationsBatch).not.toHaveBeenCalled();
    });

    // ─── Phase K.10: catalytic source checkboxes ────────────────────────

    async function chooseFile() {
        fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [makeFile()] } });
        await screen.findByText("batch.csv");
    }

    it("only imports vehicles: no catalytic source choice, and nothing but the file is sent", async () => {
        // Phase K.52: sources are chosen in the batch's Catalytic Processing. The backend's
        // defaults for a new batch (Our Database on, the others off) are what this form
        // used to tick by default, so an untouched upload behaves exactly as before.
        uploadOperationsBatch.mockResolvedValue({ id: 1, total_vehicles: 1 });
        render(<UploadBatchFlow />);
        for (const label of [/our database/i, /catdb vin/i, /catdb local/i, /ecotrade local/i]) {
            expect(screen.queryByLabelText(label)).toBeNull();
        }
        expect(screen.queryByText(/catalytic sources/i)).toBeNull();
        await chooseFile();
        fireEvent.click(screen.getByRole("button", { name: /upload/i }));
        await waitFor(() => expect(uploadOperationsBatch).toHaveBeenCalled());
        expect(uploadOperationsBatch.mock.calls[0]).toHaveLength(1);
    });
});
