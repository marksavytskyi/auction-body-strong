import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import CatdbSection from "../CatdbSection";
import { previewOperationsCatdbSearches, reconcileOperationsCatdbResults } from "@/lib/operations/api";
import { CatalyticApiError } from "@/lib/catalytic/http";

vi.mock("@/lib/operations/api", () => ({
    previewOperationsCatdbSearches: vi.fn(),
    reconcileOperationsCatdbResults: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
    default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/components/operations/CatdbApprovalHistory", () => ({ default: () => <div data-testid="approval-history" /> }));

let lastDialogProps = null;
vi.mock("@/components/operations/CatdbApprovalDialog", () => ({
    default: (props) => {
        lastDialogProps = props;
        return <div data-testid="approval-dialog" />;
    },
}));

function preview(overrides = {}) {
    return {
        operations_batch_id: 7, fingerprint: "fp-1", generated_at: "2026-01-01T00:00:00",
        total_operations_rows: 10, unique_valid_vins: 10,
        reusable_count: 2, active_existing_job_count: 1, uncertain_count: 1, conclusive_no_data_count: 1,
        never_searched_count: 5, ineligible_count: 0,
        available_quota: 100, max_approvable_new_searches: 5,
        quota_period_key: "2026-01-01", quota_reconciliation_status: "RECONCILED",
        entries: {},
        ...overrides,
    };
}

describe("CatdbSection", () => {
    beforeEach(() => {
        previewOperationsCatdbSearches.mockReset();
        reconcileOperationsCatdbResults.mockReset();
        lastDialogProps = null;
    });

    it("never calls preview or approve automatically on mount", () => {
        render(<CatdbSection batchId={7} />);
        expect(previewOperationsCatdbSearches).not.toHaveBeenCalled();
        expect(screen.queryByTestId("approval-dialog")).not.toBeInTheDocument();
    });

    it("labels the section clearly as a separate paid search process, distinct from Our Database", () => {
        render(<CatdbSection batchId={7} />);
        expect(screen.getByText(/catdb paid vin searches/i)).toBeInTheDocument();
        expect(screen.getByText(/separate, paid subscription-backed search process/i)).toBeInTheDocument();
    });

    it("fetches and renders the preview only after the explicit Preview button is clicked", async () => {
        previewOperationsCatdbSearches.mockResolvedValue(preview());
        render(<CatdbSection batchId={7} />);

        expect(previewOperationsCatdbSearches).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: /preview catdb searches/i }));

        await waitFor(() => expect(previewOperationsCatdbSearches).toHaveBeenCalledWith(7));
        expect(await screen.findByText(/quota impact/i)).toBeInTheDocument();
    });

    it("shows an explicit blocked/unknown state on a 503 (quota not establishable), never a fabricated number", async () => {
        previewOperationsCatdbSearches.mockRejectedValue(new CatalyticApiError("period has not been explicitly reconciled", { status: 503 }));
        render(<CatdbSection batchId={7} />);

        fireEvent.click(screen.getByRole("button", { name: /preview catdb searches/i }));

        expect(await screen.findByText(/quota status unknown/i)).toBeInTheDocument();
        expect(screen.queryByText(/quota impact/i)).not.toBeInTheDocument();
    });

    it("disables Approve New Searches when the quota-capped ceiling is zero", async () => {
        previewOperationsCatdbSearches.mockResolvedValue(preview({ max_approvable_new_searches: 0, never_searched_count: 0 }));
        render(<CatdbSection batchId={7} />);
        fireEvent.click(screen.getByRole("button", { name: /preview catdb searches/i }));

        const approveButton = await screen.findByRole("button", { name: /^approve new searches$/i });
        expect(approveButton).toBeDisabled();
        expect(screen.getByText(/no quota-eligible new searches/i)).toBeInTheDocument();
    });

    it("opens the approval dialog only on explicit user click, passing the exact fetched preview", async () => {
        previewOperationsCatdbSearches.mockResolvedValue(preview());
        render(<CatdbSection batchId={7} />);
        fireEvent.click(screen.getByRole("button", { name: /preview catdb searches/i }));
        await screen.findByRole("button", { name: /^approve new searches$/i });

        expect(screen.queryByTestId("approval-dialog")).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: /^approve new searches$/i }));

        expect(screen.getByTestId("approval-dialog")).toBeInTheDocument();
        expect(lastDialogProps.preview.fingerprint).toBe("fp-1");
        expect(lastDialogProps.batchId).toBe(7);
    });

    it("clears the preview and requires a fresh one after the dialog reports a stale preview", async () => {
        previewOperationsCatdbSearches.mockResolvedValue(preview());
        render(<CatdbSection batchId={7} />);
        fireEvent.click(screen.getByRole("button", { name: /preview catdb searches/i }));
        await screen.findByRole("button", { name: /^approve new searches$/i });
        fireEvent.click(screen.getByRole("button", { name: /^approve new searches$/i }));

        act(() => { lastDialogProps.onStalePreview(); });

        await waitFor(() => expect(screen.queryByText(/quota impact/i)).not.toBeInTheDocument());
        expect(screen.queryByRole("button", { name: /^approve new searches$/i })).not.toBeInTheDocument();
    });

    it("clears the preview and notifies the parent after a successful approval — never reuses the same fingerprint again", async () => {
        previewOperationsCatdbSearches.mockResolvedValue(preview());
        const onBatchDataChanged = vi.fn();
        render(<CatdbSection batchId={7} onBatchDataChanged={onBatchDataChanged} />);
        fireEvent.click(screen.getByRole("button", { name: /preview catdb searches/i }));
        await screen.findByRole("button", { name: /^approve new searches$/i });
        fireEvent.click(screen.getByRole("button", { name: /^approve new searches$/i }));

        act(() => { lastDialogProps.onApproved({ id: 1, status: "COMPLETE" }); });

        await waitFor(() => expect(screen.queryByText(/quota impact/i)).not.toBeInTheDocument());
        expect(onBatchDataChanged).toHaveBeenCalledTimes(1);
    });

    it("calls the reconcile endpoint on explicit click, and never starts/creates a new search as part of it", async () => {
        reconcileOperationsCatdbResults.mockResolvedValue({
            operations_batch_id: 7, vehicles_examined: 3, done_count: 2, no_result_count: 1,
            review_required_count: 0, still_in_flight_count: 0, unchanged_count: 0,
        });
        const onBatchDataChanged = vi.fn();
        render(<CatdbSection batchId={7} onBatchDataChanged={onBatchDataChanged} />);

        fireEvent.click(screen.getByRole("button", { name: /refresh catdb results/i }));

        await waitFor(() => expect(reconcileOperationsCatdbResults).toHaveBeenCalledWith(7));
        await waitFor(() => expect(onBatchDataChanged).toHaveBeenCalledTimes(1));
        expect(previewOperationsCatdbSearches).not.toHaveBeenCalled();
    });

    it("shows an error toast and never throws when reconciliation fails", async () => {
        const toast = (await import("react-hot-toast")).default;
        reconcileOperationsCatdbResults.mockRejectedValue(new CatalyticApiError("reconcile failed", { status: 500 }));
        render(<CatdbSection batchId={7} />);

        fireEvent.click(screen.getByRole("button", { name: /refresh catdb results/i }));

        await waitFor(() => expect(toast.error).toHaveBeenCalled());
    });
});
