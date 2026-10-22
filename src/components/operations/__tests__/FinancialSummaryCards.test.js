import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import FinancialSummaryCards from "../FinancialSummaryCards";
import { getOperationsBatchFinancialSummary } from "@/lib/operations/api";

vi.mock("@/lib/operations/api", () => ({
    getOperationsBatchFinancialSummary: vi.fn(),
}));

function summary(overrides = {}) {
    return {
        operations_batch_id: 7,
        total_vehicle_count: 10,
        complete_count: 3,
        complete_with_estimates_count: 2,
        partial_count: 4,
        no_data_count: 1,
        engine_value_total: "500.00",
        transmission_value_total: "300.00",
        cats_value_total: null,
        scrap_value_total: "120.00",
        complete_recovery_total: "900.00",
        partial_known_components_subtotal: "250.00",
        missing_engine_count: 0,
        missing_transmission_count: 0,
        missing_cats_count: 4,
        missing_scrap_count: 0,
        ...overrides,
    };
}

describe("FinancialSummaryCards", () => {
    beforeEach(() => { getOperationsBatchFinancialSummary.mockReset(); });

    it("shows two separate alternative recovery totals for a dual-source batch, never combined", async () => {
        getOperationsBatchFinancialSummary.mockResolvedValue(summary({
            catdb_recovery_total: "950.00", ourdb_recovery_total: "820.00",
        }));
        render(<FinancialSummaryCards batchId={7} refreshKey={0} />);

        expect(await screen.findByText(/recovery total.*catdb/i)).toBeInTheDocument();
        expect(await screen.findByText(/recovery total.*our database/i)).toBeInTheDocument();
        expect(screen.getByText("$950.00")).toBeInTheDocument();
        expect(screen.getByText("$820.00")).toBeInTheDocument();
        // The single-source "Complete Recovery Total" label must not
        // appear alongside the dual-source cards.
        expect(screen.queryByText(/^complete recovery total$/i)).not.toBeInTheDocument();
    });

    it("renders Complete Recovery Total and Partial Known Components Subtotal as two separate figures, never combined", async () => {
        getOperationsBatchFinancialSummary.mockResolvedValue(summary());
        render(<FinancialSummaryCards batchId={7} refreshKey={0} />);

        expect(await screen.findByText("$900.00")).toBeInTheDocument();
        expect(screen.getByText("$250.00")).toBeInTheDocument();
        // Never rendered as a single summed figure.
        expect(screen.queryByText("$1,150.00")).not.toBeInTheDocument();
    });

    it("renders completeness counts straight from the backend, never recomputed client-side", async () => {
        getOperationsBatchFinancialSummary.mockResolvedValue(summary());
        render(<FinancialSummaryCards batchId={7} refreshKey={0} />);

        await screen.findByText("$900.00");
        expect(screen.getByText("10")).toBeInTheDocument(); // total vehicles
        expect(screen.getByText("3")).toBeInTheDocument(); // complete
        expect(screen.getByText("4")).toBeInTheDocument(); // partial
        expect(screen.getByText("1")).toBeInTheDocument(); // no data
    });

    it("renders a null total as an em dash, never $0", async () => {
        getOperationsBatchFinancialSummary.mockResolvedValue(summary({ cats_value_total: null }));
        render(<FinancialSummaryCards batchId={7} refreshKey={0} />);

        await screen.findByText("$900.00");
        expect(screen.getAllByText("—").length).toBeGreaterThan(0);
        expect(screen.queryByText("$0.00")).not.toBeInTheDocument();
    });

    it("renders a real zero total as $0.00, distinct from a missing value", async () => {
        getOperationsBatchFinancialSummary.mockResolvedValue(summary({ scrap_value_total: "0.00" }));
        render(<FinancialSummaryCards batchId={7} refreshKey={0} />);

        expect(await screen.findByText("$0.00")).toBeInTheDocument();
    });

    it("shows a retryable error state on a failed load", async () => {
        getOperationsBatchFinancialSummary.mockRejectedValue(new Error("boom"));
        render(<FinancialSummaryCards batchId={7} refreshKey={0} />);
        expect(await screen.findByText(/retry/i)).toBeInTheDocument();
    });

    it("refetches when refreshKey changes", async () => {
        getOperationsBatchFinancialSummary.mockResolvedValue(summary());
        const { rerender } = render(<FinancialSummaryCards batchId={7} refreshKey={0} />);
        await waitFor(() => expect(getOperationsBatchFinancialSummary).toHaveBeenCalledTimes(1));

        rerender(<FinancialSummaryCards batchId={7} refreshKey={1} />);
        await waitFor(() => expect(getOperationsBatchFinancialSummary).toHaveBeenCalledTimes(2));
    });
});
