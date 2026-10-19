import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import ProcessingControls from "../ProcessingControls";
import { startOperationsParts, startOperationsOurDb, startOperationsWeight } from "@/lib/operations/api";

vi.mock("@/lib/operations/api", () => ({
    startOperationsParts: vi.fn(),
    startOperationsOurDb: vi.fn(),
    startOperationsWeight: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
    default: { success: vi.fn(), error: vi.fn() },
}));

const baseBatch = { id: 1, run_parts: true, run_ourdb: true, run_weight: true, parts_job_status: null };

describe("ProcessingControls", () => {
    beforeEach(() => {
        startOperationsParts.mockReset();
        startOperationsOurDb.mockReset();
        startOperationsWeight.mockReset();
    });

    it("starting Parts only calls the Parts endpoint, never OurDB or Weight", async () => {
        startOperationsParts.mockResolvedValue({ ...baseBatch, parts_job_status: "processing" });
        render(<ProcessingControls batch={baseBatch} onBatchUpdated={vi.fn()} />);

        fireEvent.click(screen.getAllByRole("button", { name: /^start$/i })[0]);

        await waitFor(() => expect(startOperationsParts).toHaveBeenCalledWith(1));
        expect(startOperationsOurDb).not.toHaveBeenCalled();
        expect(startOperationsWeight).not.toHaveBeenCalled();
    });

    it("starting Our Database only calls the OurDB endpoint, never Parts or Weight — and never CatDB", async () => {
        startOperationsOurDb.mockResolvedValue(baseBatch);
        render(<ProcessingControls batch={baseBatch} onBatchUpdated={vi.fn()} />);

        fireEvent.click(screen.getAllByRole("button", { name: /^start$/i })[1]);

        await waitFor(() => expect(startOperationsOurDb).toHaveBeenCalledWith(1));
        expect(startOperationsParts).not.toHaveBeenCalled();
        expect(startOperationsWeight).not.toHaveBeenCalled();
    });

    it("starting Weight only calls the Weight endpoint", async () => {
        startOperationsWeight.mockResolvedValue(baseBatch);
        render(<ProcessingControls batch={baseBatch} onBatchUpdated={vi.fn()} />);

        fireEvent.click(screen.getAllByRole("button", { name: /^start$/i })[2]);

        await waitFor(() => expect(startOperationsWeight).toHaveBeenCalledWith(1));
        expect(startOperationsParts).not.toHaveBeenCalled();
        expect(startOperationsOurDb).not.toHaveBeenCalled();
    });

    it("disables Start for a leg the batch has disabled", () => {
        render(<ProcessingControls batch={{ ...baseBatch, run_weight: false }} onBatchUpdated={vi.fn()} />);
        const buttons = screen.getAllByRole("button", { name: /^start$/i });
        expect(buttons[2]).toBeDisabled();
        expect(screen.getByText(/disabled for this batch/i)).toBeInTheDocument();
    });

    it("shows the real backend parts_job_status rather than a fabricated progress count", () => {
        render(<ProcessingControls batch={{ ...baseBatch, parts_job_status: "done" }} onBatchUpdated={vi.fn()} />);
        expect(screen.getByText(/^done$/i)).toBeInTheDocument();
    });
});
