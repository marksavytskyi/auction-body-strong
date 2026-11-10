import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import FinancialSummaryCards, { financialHeadline } from "../FinancialSummaryCards";
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

// Phase K.52: the section is closed by default, so each test opens it first.
async function show() {
    render(<FinancialSummaryCards batchId={7} refreshKey={0} />);
    const header = await screen.findByRole("button", { name: /Financial Summary/ });
    await waitFor(() => expect(header).not.toHaveTextContent("Loading"));
    fireEvent.click(header);
    return header;
}

describe("FinancialSummaryCards", () => {
    beforeEach(() => { getOperationsBatchFinancialSummary.mockReset(); });

    it("shows two separate alternative recovery totals for a dual-source batch, never combined", async () => {
        getOperationsBatchFinancialSummary.mockResolvedValue(summary({
            catdb_recovery_total: "950.00", ourdb_recovery_total: "820.00",
        }));
        await show();

        expect(await screen.findByText("Recovery Total — CatDB")).toBeInTheDocument();
        expect(await screen.findByText("Recovery Total — Our Database")).toBeInTheDocument();
        expect(screen.getByText("$950.00")).toBeInTheDocument();
        expect(screen.getByText("$820.00")).toBeInTheDocument();
        // The single-source "Complete Recovery Total" label must not
        // appear alongside the dual-source cards.
        expect(screen.queryByText(/^complete recovery total$/i)).not.toBeInTheDocument();
    });

    it("renders Complete Recovery Total and Partial Known Components Subtotal as two separate figures, never combined", async () => {
        getOperationsBatchFinancialSummary.mockResolvedValue(summary());
        await show();

        expect(await screen.findByText("$900.00")).toBeInTheDocument();
        expect(screen.getByText("$250.00")).toBeInTheDocument();
        // Never rendered as a single summed figure.
        expect(screen.queryByText("$1,150.00")).not.toBeInTheDocument();
    });

    it("renders completeness counts straight from the backend, never recomputed client-side", async () => {
        getOperationsBatchFinancialSummary.mockResolvedValue(summary());
        await show();

        await screen.findByText("$900.00");
        expect(screen.getByText("10")).toBeInTheDocument(); // total vehicles
        expect(screen.getByText("3")).toBeInTheDocument(); // complete
        expect(screen.getByText("4")).toBeInTheDocument(); // partial
        expect(screen.getByText("1")).toBeInTheDocument(); // no data
    });

    it("renders a null total as an em dash, never $0", async () => {
        getOperationsBatchFinancialSummary.mockResolvedValue(summary({ cats_value_total: null }));
        await show();

        await screen.findByText("$900.00");
        expect(screen.getAllByText("—").length).toBeGreaterThan(0);
        expect(screen.queryByText("$0.00")).not.toBeInTheDocument();
    });

    it("renders a real zero total as $0.00, distinct from a missing value", async () => {
        getOperationsBatchFinancialSummary.mockResolvedValue(summary({ scrap_value_total: "0.00" }));
        await show();

        expect(await screen.findByText("$0.00")).toBeInTheDocument();
    });

    it("shows a retryable error state on a failed load", async () => {
        getOperationsBatchFinancialSummary.mockRejectedValue(new Error("boom"));
        await show();
        expect(await screen.findByText(/retry/i)).toBeInTheDocument();
    });

    it("refetches when refreshKey changes", async () => {
        getOperationsBatchFinancialSummary.mockResolvedValue(summary());
        const { rerender } = render(<FinancialSummaryCards batchId={7} refreshKey={0} />);
        await waitFor(() => expect(getOperationsBatchFinancialSummary).toHaveBeenCalledTimes(1));

        rerender(<FinancialSummaryCards batchId={7} refreshKey={1} />);
        await waitFor(() => expect(getOperationsBatchFinancialSummary).toHaveBeenCalledTimes(2));
    });

    it("is closed by default, with one honest headline and the rules state", async () => {
        getOperationsBatchFinancialSummary.mockResolvedValue(summary());
        render(<FinancialSummaryCards batchId={7} refreshKey={0} />);
        const header = await screen.findByRole("button", { name: /Financial Summary/ });
        await waitFor(() => expect(header).toHaveTextContent("Complete Recovery Total $900.00 · 5 of 10 vehicles"));
        expect(header).toHaveAttribute("aria-expanded", "false");
        expect(header).toHaveTextContent("Rules not active");
        expect(screen.queryByText("Engine Total")).toBeNull();
    });

    it("never shows a $0.00 total that really means nothing is calculated", async () => {
        expect(financialHeadline(summary({ complete_count: 0, complete_with_estimates_count: 0, complete_recovery_total: "0.00" }))).toBe("No complete vehicles yet");
        expect(financialHeadline(summary({ rules_active: true, known_value_total: null }))).toBe("Recovery Total not calculated yet");
        expect(financialHeadline(summary({ rules_active: true, known_value_total: "1234.50" }))).toBe("Recovery Total $1,234.50");
        getOperationsBatchFinancialSummary.mockResolvedValue(summary({ complete_count: 0, complete_with_estimates_count: 0, complete_recovery_total: "0.00" }));
        await show();
        expect(await screen.findByText("Not calculated: no complete vehicles yet")).toBeInTheDocument();
        expect(screen.getByText(/Recovery Rules aren.t active for this batch/)).toBeInTheDocument();
    });

    it("an expanded summary keeps every existing figure", async () => {
        getOperationsBatchFinancialSummary.mockResolvedValue(summary());
        await show();
        for (const label of ["Complete Recovery Total", "Partial Known Components Subtotal", "Engine Total", "Transmission Total", "Selected Catalytic Total", "Scrap Total", "Total Vehicles", "Complete", "Partial", "No Data"]) {
            expect(screen.getAllByText(label).length).toBeGreaterThan(0);
        }
    });
});

