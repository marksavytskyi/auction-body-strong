import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import CatdbApprovalDialog from "../CatdbApprovalDialog";
import { approveOperationsCatdbSearches } from "@/lib/operations/api";
import { CatalyticApiError } from "@/lib/catalytic/http";

vi.mock("@/lib/operations/api", () => ({
    approveOperationsCatdbSearches: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
    default: { success: vi.fn(), error: vi.fn() },
}));

function preview(overrides = {}) {
    return {
        operations_batch_id: 7, fingerprint: "fp-abcdef123456", generated_at: "2026-01-01T00:00:00",
        total_operations_rows: 10, unique_valid_vins: 10,
        reusable_count: 2, active_existing_job_count: 1, uncertain_count: 1, conclusive_no_data_count: 1,
        never_searched_count: 5, ineligible_count: 0,
        available_quota: 100, max_approvable_new_searches: 5,
        quota_period_key: "2026-01-01", quota_reconciliation_status: "RECONCILED",
        entries: [],
        ...overrides,
    };
}

async function clickApprove() {
    await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /^approve/i }));
    });
}

describe("CatdbApprovalDialog", () => {
    beforeEach(() => { approveOperationsCatdbSearches.mockReset(); });

    it("disables Approve until the acknowledgment checkbox is checked", () => {
        render(<CatdbApprovalDialog batchId={7} preview={preview()} onClose={vi.fn()} onApproved={vi.fn()} onStalePreview={vi.fn()} />);
        expect(screen.getByRole("button", { name: /^approve/i })).toBeDisabled();
    });

    it("requires max_new_searches to be within [0, max_approvable_new_searches]", () => {
        render(<CatdbApprovalDialog batchId={7} preview={preview({ max_approvable_new_searches: 5 })} onClose={vi.fn()} onApproved={vi.fn()} onStalePreview={vi.fn()} />);
        fireEvent.click(screen.getByRole("checkbox"));
        const input = screen.getByLabelText(/maximum new searches/i);

        fireEvent.change(input, { target: { value: "6" } });
        expect(screen.getByRole("button", { name: /^approve/i })).toBeDisabled();

        fireEvent.change(input, { target: { value: "5" } });
        expect(screen.getByRole("button", { name: /^approve/i })).not.toBeDisabled();
    });

    it("sends the exact preview fingerprint, the entered max_new_searches, and confirm:true on Approve", async () => {
        approveOperationsCatdbSearches.mockResolvedValue({ id: 1, status: "COMPLETE" });
        const onApproved = vi.fn();
        render(<CatdbApprovalDialog batchId={7} preview={preview()} onClose={vi.fn()} onApproved={onApproved} onStalePreview={vi.fn()} />);

        fireEvent.click(screen.getByRole("checkbox"));
        fireEvent.change(screen.getByLabelText(/maximum new searches/i), { target: { value: "3" } });
        await clickApprove();

        await waitFor(() => expect(approveOperationsCatdbSearches).toHaveBeenCalledWith(7, {
            previewFingerprint: "fp-abcdef123456", maxNewSearches: 3, confirm: true,
        }));
        await waitFor(() => expect(onApproved).toHaveBeenCalledWith({ id: 1, status: "COMPLETE" }));
    });

    it("never calls the approve endpoint on mount — approval requires the explicit Approve click", () => {
        render(<CatdbApprovalDialog batchId={7} preview={preview()} onClose={vi.fn()} onApproved={vi.fn()} onStalePreview={vi.fn()} />);
        expect(approveOperationsCatdbSearches).not.toHaveBeenCalled();
    });

    it("on a 409 stale-preview rejection, shows the error and signals the parent to require a fresh preview, without retrying itself", async () => {
        approveOperationsCatdbSearches.mockRejectedValue(new CatalyticApiError("preview fingerprint no longer matches", { status: 409 }));
        const onStalePreview = vi.fn();
        render(<CatdbApprovalDialog batchId={7} preview={preview()} onClose={vi.fn()} onApproved={vi.fn()} onStalePreview={onStalePreview} />);

        fireEvent.click(screen.getByRole("checkbox"));
        await clickApprove();

        expect(await screen.findByText(/no longer matches/i)).toBeInTheDocument();
        expect(onStalePreview).toHaveBeenCalledTimes(1);
        expect(approveOperationsCatdbSearches).toHaveBeenCalledTimes(1);
    });

    it("on a non-409 error, shows the message but never calls onStalePreview", async () => {
        approveOperationsCatdbSearches.mockRejectedValue(new CatalyticApiError("internal server error", { status: 500 }));
        const onStalePreview = vi.fn();
        render(<CatdbApprovalDialog batchId={7} preview={preview()} onClose={vi.fn()} onApproved={vi.fn()} onStalePreview={onStalePreview} />);

        fireEvent.click(screen.getByRole("checkbox"));
        await clickApprove();

        expect(await screen.findByText(/internal server error/i)).toBeInTheDocument();
        expect(onStalePreview).not.toHaveBeenCalled();
    });

    it("defaults the max-searches input to the quota-capped ceiling, never a higher number", () => {
        render(<CatdbApprovalDialog batchId={7} preview={preview({ max_approvable_new_searches: 5 })} onClose={vi.fn()} onApproved={vi.fn()} onStalePreview={vi.fn()} />);
        expect(screen.getByLabelText(/maximum new searches/i)).toHaveValue(5);
    });

    it("calls onClose, never the approve endpoint, when Cancel is clicked", () => {
        const onClose = vi.fn();
        render(<CatdbApprovalDialog batchId={7} preview={preview()} onClose={onClose} onApproved={vi.fn()} onStalePreview={vi.fn()} />);
        fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
        expect(onClose).toHaveBeenCalled();
        expect(approveOperationsCatdbSearches).not.toHaveBeenCalled();
    });
});
