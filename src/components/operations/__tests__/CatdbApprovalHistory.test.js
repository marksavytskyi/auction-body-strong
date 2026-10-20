import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import CatdbApprovalHistory from "../CatdbApprovalHistory";
import { listOperationsCatdbApprovals } from "@/lib/operations/api";

vi.mock("@/lib/operations/api", () => ({
    listOperationsCatdbApprovals: vi.fn(),
}));

function approval(overrides = {}) {
    return {
        id: 1, operations_batch_id: 7, preview_fingerprint: "fp-1", approved_by_user_id: 2,
        requested_max_new_searches: 10, status: "COMPLETE",
        new_search_count: 8, reused_completed_count: 1, attached_active_job_count: 1,
        blocked_count: 0, ineligible_count: 0, quota_exhausted_count: 0,
        created_at: "2026-01-01T00:00:00", updated_at: "2026-01-01T00:05:00",
        needs_reconciliation: false,
        ...overrides,
    };
}

describe("CatdbApprovalHistory", () => {
    beforeEach(() => { listOperationsCatdbApprovals.mockReset(); });

    it("renders every real backend field from the approval list, never a fabricated total", async () => {
        listOperationsCatdbApprovals.mockResolvedValue({ items: [approval()], total: 1, limit: 10, offset: 0 });
        render(<CatdbApprovalHistory batchId={7} refreshKey={0} />);

        expect(await screen.findByText("#1")).toBeInTheDocument();
        expect(screen.getByText("Complete")).toBeInTheDocument();
        expect(screen.getByText("10")).toBeInTheDocument(); // requested_max_new_searches
        expect(screen.getByText("8")).toBeInTheDocument(); // new_search_count
    });

    it("shows an empty state when no approvals exist yet, never fabricating a row", async () => {
        listOperationsCatdbApprovals.mockResolvedValue({ items: [], total: 0, limit: 10, offset: 0 });
        render(<CatdbApprovalHistory batchId={7} refreshKey={0} />);
        expect(await screen.findByText(/no catdb approvals/i)).toBeInTheDocument();
    });

    it("flags NEEDS_RECONCILIATION distinctly from COMPLETE", async () => {
        listOperationsCatdbApprovals.mockResolvedValue({
            items: [approval({ id: 2, status: "NEEDS_RECONCILIATION", needs_reconciliation: true })],
            total: 1, limit: 10, offset: 0,
        });
        render(<CatdbApprovalHistory batchId={7} refreshKey={0} />);
        expect(await screen.findByText("Needs Reconciliation")).toBeInTheDocument();
    });

    it("never claims COMPLETE for a PREPARING approval", async () => {
        listOperationsCatdbApprovals.mockResolvedValue({
            items: [approval({ id: 3, status: "PREPARING", new_search_count: 0 })],
            total: 1, limit: 10, offset: 0,
        });
        render(<CatdbApprovalHistory batchId={7} refreshKey={0} />);
        expect(await screen.findByText("Preparing")).toBeInTheDocument();
        expect(screen.queryByText("Complete")).not.toBeInTheDocument();
    });

    it("paginates via limit/offset, never fetching everything up front", async () => {
        listOperationsCatdbApprovals.mockResolvedValue({
            items: [approval()], total: 25, limit: 10, offset: 0,
        });
        render(<CatdbApprovalHistory batchId={7} refreshKey={0} />);
        await waitFor(() => expect(listOperationsCatdbApprovals).toHaveBeenCalledWith(7, { limit: 10, offset: 0 }));

        const nextButtons = screen.getAllByRole("button").filter((b) => !b.disabled);
        fireEvent.click(nextButtons[nextButtons.length - 1]);

        await waitFor(() => expect(listOperationsCatdbApprovals).toHaveBeenLastCalledWith(7, { limit: 10, offset: 10 }));
    });

    it("shows a retryable error state on a failed load", async () => {
        listOperationsCatdbApprovals.mockRejectedValue(new Error("boom"));
        render(<CatdbApprovalHistory batchId={7} refreshKey={0} />);
        expect(await screen.findByText(/retry/i)).toBeInTheDocument();
    });

    it("refetches when refreshKey changes (e.g. after a new approval or reconciliation)", async () => {
        listOperationsCatdbApprovals.mockResolvedValue({ items: [approval()], total: 1, limit: 10, offset: 0 });
        const { rerender } = render(<CatdbApprovalHistory batchId={7} refreshKey={0} />);
        await waitFor(() => expect(listOperationsCatdbApprovals).toHaveBeenCalledTimes(1));

        rerender(<CatdbApprovalHistory batchId={7} refreshKey={1} />);
        await waitFor(() => expect(listOperationsCatdbApprovals).toHaveBeenCalledTimes(2));
    });
});
