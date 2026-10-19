import { render, screen, waitFor, cleanup, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import OperationsBatchDetailPage from "../page";
import { getOperationsBatch } from "@/lib/operations/api";
import { CatalyticApiError } from "@/lib/catalytic/http";

vi.mock("next/navigation", () => ({
    useParams: () => ({ id: "7" }),
    useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/operations/api", () => ({
    getOperationsBatch: vi.fn(),
}));

// Isolate the page's own polling/loading/error behavior from the heavy
// child components (each has its own dedicated test file already).
vi.mock("@/components/operations/ProcessingControls", () => ({ default: () => <div data-testid="processing-controls" /> }));
vi.mock("@/components/operations/BatchStatusSummary", () => ({ default: () => <div data-testid="status-summary" /> }));
vi.mock("@/components/operations/VehicleTable", () => ({ default: () => <div data-testid="vehicle-table" /> }));
vi.mock("@/components/operations/VehicleDetailModal", () => ({ default: () => null }));

function doneBatch(overrides = {}) {
    return { id: 7, status: "DONE", total_vehicles: 10, created_at: "2026-01-01T00:00:00", error_message: "", ...overrides };
}

describe("OperationsBatchDetailPage", () => {
    beforeEach(() => {
        getOperationsBatch.mockReset();
    });

    afterEach(() => {
        cleanup();
        vi.useRealTimers();
    });

    it("renders the batch header and child sections once loaded", async () => {
        getOperationsBatch.mockResolvedValue(doneBatch());
        render(<OperationsBatchDetailPage />);

        expect(await screen.findByText("Batch #7")).toBeInTheDocument();
        expect(screen.getByTestId("processing-controls")).toBeInTheDocument();
        expect(screen.getByTestId("status-summary")).toBeInTheDocument();
        expect(screen.getByTestId("vehicle-table")).toBeInTheDocument();
    });

    it("shows a retryable error state on a failed load", async () => {
        getOperationsBatch.mockRejectedValue(new CatalyticApiError("Failed to load batch", { status: 404 }));
        render(<OperationsBatchDetailPage />);
        expect(await screen.findByText(/failed to load batch/i)).toBeInTheDocument();
    });

    it("polls while the batch is PROCESSING and stops once it reaches a terminal status", async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        getOperationsBatch
            .mockResolvedValueOnce(doneBatch({ status: "PROCESSING" }))
            .mockResolvedValueOnce(doneBatch({ status: "PROCESSING" }))
            .mockResolvedValueOnce(doneBatch({ status: "DONE" }));

        render(<OperationsBatchDetailPage />);
        await waitFor(() => expect(getOperationsBatch).toHaveBeenCalledTimes(1));

        await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
        await waitFor(() => expect(getOperationsBatch).toHaveBeenCalledTimes(2));

        await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
        await waitFor(() => expect(getOperationsBatch).toHaveBeenCalledTimes(3));

        // Batch is now DONE — no further poll should ever fire, no matter
        // how much more time passes.
        await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
        expect(getOperationsBatch).toHaveBeenCalledTimes(3);
    });

    it("never polls at all when the batch is already in a terminal status on load", async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        getOperationsBatch.mockResolvedValue(doneBatch({ status: "DONE" }));

        render(<OperationsBatchDetailPage />);
        await waitFor(() => expect(getOperationsBatch).toHaveBeenCalledTimes(1));

        await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
        expect(getOperationsBatch).toHaveBeenCalledTimes(1);
    });

    it("stops polling on unmount and never fires a request against a torn-down component", async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        getOperationsBatch.mockResolvedValue(doneBatch({ status: "PROCESSING" }));

        const { unmount } = render(<OperationsBatchDetailPage />);
        await waitFor(() => expect(getOperationsBatch).toHaveBeenCalledTimes(1));

        unmount();
        getOperationsBatch.mockClear();

        await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
        expect(getOperationsBatch).not.toHaveBeenCalled();
    });
});
