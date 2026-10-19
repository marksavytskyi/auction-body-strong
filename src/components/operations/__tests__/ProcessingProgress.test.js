import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import ProcessingProgress from "../ProcessingProgress";
import { getOperationsBatchProgress } from "@/lib/operations/api";

vi.mock("@/lib/operations/api", () => ({
    getOperationsBatchProgress: vi.fn(),
}));

const leg = (overrides = {}) => ({
    not_requested_count: 0, queued_count: 0, processing_count: 0, done_count: 0, failed_count: 0, no_data_count: 0, total: 0,
    ...overrides,
});

function progress(overrides = {}) {
    return {
        operations_batch_id: 7,
        total_vehicle_count: 10,
        parts: leg({ done_count: 10, total: 10 }),
        ourdb: leg({ queued_count: 3, done_count: 7, total: 10 }),
        weight: leg({ done_count: 6, no_data_count: 4, total: 10 }),
        ...overrides,
    };
}

describe("ProcessingProgress", () => {
    beforeEach(() => { getOperationsBatchProgress.mockReset(); });

    it("renders separate sections for Parts, OurDB, and Weight", async () => {
        getOperationsBatchProgress.mockResolvedValue(progress());
        render(<ProcessingProgress batchId={7} refreshKey={0} />);

        expect(await screen.findByText("Parts")).toBeInTheDocument();
        expect(screen.getByText("Our Database")).toBeInTheDocument();
        expect(screen.getByText("Weight")).toBeInTheDocument();
    });

    it("shows Weight's terminal no_data_count as 'No data', never 'Pending'", async () => {
        getOperationsBatchProgress.mockResolvedValue(progress());
        render(<ProcessingProgress batchId={7} refreshKey={0} />);

        await screen.findByText("Weight");
        expect(screen.getByText("No data")).toBeInTheDocument();
        expect(screen.queryByText(/pending/i)).not.toBeInTheDocument();
    });

    it("never shows a Failed bucket for Weight (it has no such status) and never a No data bucket for Parts/OurDB", async () => {
        getOperationsBatchProgress.mockResolvedValue(progress());
        render(<ProcessingProgress batchId={7} refreshKey={0} />);
        await screen.findByText("Weight");

        const weightSection = screen.getByText("Weight").closest("div").parentElement;
        expect(weightSection.textContent).not.toMatch(/failed/i);

        const partsSection = screen.getByText("Parts").closest("div").parentElement;
        expect(partsSection.textContent).not.toMatch(/no data/i);
    });

    it("renders only the real backend counts, never a client-computed total", async () => {
        getOperationsBatchProgress.mockResolvedValue(progress());
        render(<ProcessingProgress batchId={7} refreshKey={0} />);

        await screen.findByText("Parts");
        expect(screen.getAllByText("10 total").length).toBe(3);
    });

    it("shows a retryable error state on a failed load", async () => {
        getOperationsBatchProgress.mockRejectedValue(new Error("boom"));
        render(<ProcessingProgress batchId={7} refreshKey={0} />);
        expect(await screen.findByText(/retry/i)).toBeInTheDocument();
    });

    it("refetches when refreshKey changes", async () => {
        getOperationsBatchProgress.mockResolvedValue(progress());
        const { rerender } = render(<ProcessingProgress batchId={7} refreshKey={0} />);
        await waitFor(() => expect(getOperationsBatchProgress).toHaveBeenCalledTimes(1));

        rerender(<ProcessingProgress batchId={7} refreshKey={1} />);
        await waitFor(() => expect(getOperationsBatchProgress).toHaveBeenCalledTimes(2));
    });
});
