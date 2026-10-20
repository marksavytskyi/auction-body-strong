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

let lastHistoryProps = null;
vi.mock("@/components/operations/CatdbApprovalHistory", () => ({
    default: (props) => {
        lastHistoryProps = props;
        return <div data-testid="approval-history" />;
    },
}));

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
        entries: [],
        ...overrides,
    };
}

describe("CatdbSection", () => {
    beforeEach(() => {
        previewOperationsCatdbSearches.mockReset();
        reconcileOperationsCatdbResults.mockReset();
        lastDialogProps = null;
        lastHistoryProps = null;
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

    // ─── preview.entries is a real array (Phase H finding L1 / Phase I-B) ──

    function entry(overrides = {}) {
        return { vin: "1HGCM82633A000001", category: "UNCERTAIN_SUBMISSION", reason: "needs review", existing_job_id: null, operations_batch_vehicle_ids: [1], ...overrides };
    }

    it("renders uncertain/ineligible entries from a real backend array, never requiring Object.values()", async () => {
        previewOperationsCatdbSearches.mockResolvedValue(preview({
            entries: [
                entry({ vin: "1HGCM82633A000001", category: "UNCERTAIN_SUBMISSION", reason: "manual review pending" }),
                entry({ vin: "1HGCM82633A000002", category: "INELIGIBLE", reason: "electric vehicle" }),
            ],
        }));
        render(<CatdbSection batchId={7} />);
        fireEvent.click(screen.getByRole("button", { name: /preview catdb searches/i }));

        const toggle = await screen.findByText(/uncertain \/ blocked vins \(2\)/i);
        fireEvent.click(toggle);

        expect(await screen.findByText("1HGCM82633A000001")).toBeInTheDocument();
        expect(screen.getByText("1HGCM82633A000002")).toBeInTheDocument();
        expect(screen.getByText(/manual review pending/i)).toBeInTheDocument();
        expect(screen.getByText(/electric vehicle/i)).toBeInTheDocument();
    });

    it("filters out reusable/active/no-data/never-searched entries from the uncertain/blocked detail list", async () => {
        previewOperationsCatdbSearches.mockResolvedValue(preview({
            entries: [
                entry({ vin: "V-REUSABLE", category: "COMPLETED_REUSABLE" }),
                entry({ vin: "V-ACTIVE", category: "ACTIVE_EXISTING_JOB" }),
                entry({ vin: "V-NODATA", category: "CONCLUSIVE_NO_DATA" }),
                entry({ vin: "V-NEVERSEARCHED", category: "NEVER_SEARCHED" }),
                entry({ vin: "V-UNCERTAIN", category: "UNCERTAIN_SUBMISSION" }),
            ],
        }));
        render(<CatdbSection batchId={7} />);
        fireEvent.click(screen.getByRole("button", { name: /preview catdb searches/i }));

        const toggle = await screen.findByText(/uncertain \/ blocked vins \(1\)/i);
        fireEvent.click(toggle);

        expect(await screen.findByText("V-UNCERTAIN")).toBeInTheDocument();
        expect(screen.queryByText("V-REUSABLE")).not.toBeInTheDocument();
        expect(screen.queryByText("V-ACTIVE")).not.toBeInTheDocument();
        expect(screen.queryByText("V-NODATA")).not.toBeInTheDocument();
        expect(screen.queryByText("V-NEVERSEARCHED")).not.toBeInTheDocument();
    });

    it("caps the rendered detail list at 50 rows and notes how many more exist", async () => {
        const entries = Array.from({ length: 60 }, (_, i) => entry({ vin: `V${i}`, category: "INELIGIBLE" }));
        previewOperationsCatdbSearches.mockResolvedValue(preview({ entries }));
        render(<CatdbSection batchId={7} />);
        fireEvent.click(screen.getByRole("button", { name: /preview catdb searches/i }));

        const toggle = await screen.findByText(/uncertain \/ blocked vins \(60\)/i);
        fireEvent.click(toggle);

        expect(await screen.findByText("V0")).toBeInTheDocument();
        expect(screen.getByText("V49")).toBeInTheDocument();
        expect(screen.queryByText("V50")).not.toBeInTheDocument();
        expect(screen.getByText(/\+10 more not shown/i)).toBeInTheDocument();
    });

    it("never crashes when preview.entries is missing entirely", async () => {
        const withoutEntries = preview();
        delete withoutEntries.entries;
        previewOperationsCatdbSearches.mockResolvedValue(withoutEntries);
        render(<CatdbSection batchId={7} />);
        fireEvent.click(screen.getByRole("button", { name: /preview catdb searches/i }));

        expect(await screen.findByText(/quota impact/i)).toBeInTheDocument();
        expect(screen.queryByText(/uncertain \/ blocked vins/i)).not.toBeInTheDocument();
    });

    // ─── approval-history refresh behavior (Phase H finding L4 / Phase I-B) ──

    it("refreshes approval history on the page's own poll tick while an approval is IN_PROGRESS, without a second interval", async () => {
        const { rerender } = render(<CatdbSection batchId={7} refreshKey={0} />);
        const initialHistoryKey = lastHistoryProps.refreshKey;

        // Simulate what the real CatdbApprovalHistory reports after its
        // own fetch resolves: one approval still IN_PROGRESS.
        act(() => { lastHistoryProps.onApprovalsLoaded([{ id: 1, status: "IN_PROGRESS" }]); });

        // The page's own poll tick bumps refreshKey — must propagate
        // into a fresh approvalRefreshKey for CatdbApprovalHistory.
        rerender(<CatdbSection batchId={7} refreshKey={1} />);
        await waitFor(() => expect(lastHistoryProps.refreshKey).not.toBe(initialHistoryKey));
    });

    it("stops refreshing approval history on further poll ticks once every approval is terminal (COMPLETE)", async () => {
        const { rerender } = render(<CatdbSection batchId={7} refreshKey={0} />);

        act(() => { lastHistoryProps.onApprovalsLoaded([{ id: 1, status: "COMPLETE" }]); });
        const settledKey = lastHistoryProps.refreshKey;

        rerender(<CatdbSection batchId={7} refreshKey={1} />);
        expect(lastHistoryProps.refreshKey).toBe(settledKey);

        rerender(<CatdbSection batchId={7} refreshKey={2} />);
        expect(lastHistoryProps.refreshKey).toBe(settledKey);
    });

    it("never keeps polling approval history indefinitely for a NEEDS_RECONCILIATION-only state — it is a stable, manual-action state", async () => {
        const { rerender } = render(<CatdbSection batchId={7} refreshKey={0} />);

        act(() => { lastHistoryProps.onApprovalsLoaded([{ id: 1, status: "NEEDS_RECONCILIATION", needs_reconciliation: true }]); });
        const settledKey = lastHistoryProps.refreshKey;

        rerender(<CatdbSection batchId={7} refreshKey={1} />);
        expect(lastHistoryProps.refreshKey).toBe(settledKey);

        rerender(<CatdbSection batchId={7} refreshKey={2} />);
        expect(lastHistoryProps.refreshKey).toBe(settledKey);
    });

    it("never bumps the approval-history refresh key on initial mount, only on a subsequent page refreshKey change", () => {
        render(<CatdbSection batchId={7} refreshKey={5} />);
        expect(lastHistoryProps.refreshKey).toBe(0);
    });

    it("never calls preview, approve, or reconcile automatically as a side effect of the poll-driven approval-history refresh", async () => {
        const { rerender } = render(<CatdbSection batchId={7} refreshKey={0} />);
        act(() => { lastHistoryProps.onApprovalsLoaded([{ id: 1, status: "IN_PROGRESS" }]); });

        rerender(<CatdbSection batchId={7} refreshKey={1} />);
        await waitFor(() => expect(lastHistoryProps.refreshKey).toBe(1));

        expect(previewOperationsCatdbSearches).not.toHaveBeenCalled();
        expect(reconcileOperationsCatdbResults).not.toHaveBeenCalled();
    });
});
