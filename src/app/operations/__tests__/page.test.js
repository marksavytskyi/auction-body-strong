import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import OperationsOverviewPage from "../page";
import { listOperationsBatches } from "@/lib/operations/api";
import { CatalyticApiError } from "@/lib/catalytic/http";

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/operations/api", () => ({
    listOperationsBatches: vi.fn(),
    uploadOperationsBatch: vi.fn(),
}));

describe("OperationsOverviewPage", () => {
    beforeEach(() => {
        listOperationsBatches.mockReset();
    });

    it("renders every real batch from the backend list response", async () => {
        listOperationsBatches.mockResolvedValue({
            items: [
                { id: 1, status: "DONE", total_vehicles: 400, created_at: "2026-01-01T00:00:00", created_by_email: "a@b.com" },
                { id: 2, status: "PROCESSING", total_vehicles: 120, created_at: "2026-01-02T00:00:00", created_by_email: "a@b.com", parts_job_status: "processing" },
            ],
            total: 2, limit: 50, offset: 0,
        });

        render(<OperationsOverviewPage />);

        expect(await screen.findByText("Batch #1")).toBeInTheDocument();
        expect(screen.getByText("Batch #2")).toBeInTheDocument();
        expect(screen.getByText(/400/)).toBeInTheDocument();
    });

    it("shows an explicit empty state, never a fabricated batch, when there are none", async () => {
        listOperationsBatches.mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 });
        render(<OperationsOverviewPage />);
        expect(await screen.findByText(/no operations batches yet/i)).toBeInTheDocument();
    });

    it("shows a retryable error state on a failed load, not a silent blank page", async () => {
        listOperationsBatches.mockRejectedValue(new CatalyticApiError("Failed to load Operations batches", { status: 500 }));
        render(<OperationsOverviewPage />);
        expect(await screen.findByText(/failed to load operations batches/i)).toBeInTheDocument();
        expect(screen.getByText(/retry/i)).toBeInTheDocument();
    });

    it("shows a loading state before the batch list resolves", () => {
        listOperationsBatches.mockReturnValue(new Promise(() => {})); // never resolves
        render(<OperationsOverviewPage />);
        expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });
});
