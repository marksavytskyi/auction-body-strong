import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import BulkRecoveryDialog from "../BulkRecoveryDialog";
import { applyBulkRecovery, previewBulkRecovery } from "@/lib/operations/api";
import { CatalyticApiError } from "@/lib/catalytic/http";

vi.mock("@/lib/operations/api", () => ({ applyBulkRecovery: vi.fn(), previewBulkRecovery: vi.fn() }));
vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const PREVIEW = {
    rules_active: true, vehicles_evaluated: 2, vehicles_affected: 2, current_total: "100.00", new_total: "50.00",
    difference: "-50.00", catalytic_sources: { CATDB_VIN: 2 }, missing_values: 0, approximate_included: 0, uncertain_excluded: 0, completeness: {},
};

function setup() {
    const onApplied = vi.fn();
    const onClose = vi.fn();
    render(<BulkRecoveryDialog batchId={1} vehicleIds={[3, 4]} onApplied={onApplied} onClose={onClose} />);
    return { onApplied, onClose };
}

describe("BulkRecoveryDialog", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        previewBulkRecovery.mockResolvedValue(PREVIEW);
        applyBulkRecovery.mockResolvedValue({ vehicles_selected: 2, vehicles_updated: 2, vehicles_unchanged: 0 });
    });

    it("needs a choice before it can preview", () => {
        setup();
        expect(screen.getByRole("button", { name: "Preview" })).toBeDisabled();
    });

    it("sends only what was chosen, previews, then applies the same body", async () => {
        const { onApplied, onClose } = setup();
        fireEvent.change(screen.getByLabelText("Engine"), { target: { value: "false" } });
        fireEvent.change(screen.getByLabelText("Catalytic source"), { target: { value: "__reset" } });
        fireEvent.change(screen.getByLabelText("Valuation mode"), { target: { value: "HIGH" } });
        fireEvent.click(screen.getByRole("button", { name: "Preview" }));
        const body = {
            vehicle_ids: [3, 4], changes: { include_engine: false, valuation_mode: "HIGH" },
            reset_fields: ["catalytic_source"], restore_batch_defaults: false,
        };
        await waitFor(() => expect(previewBulkRecovery).toHaveBeenCalledWith(1, body));
        // K.60 — per-vehicle counts, never a batch total.
        expect(await screen.findByText("2 of 2")).toBeInTheDocument();
        expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
        expect(applyBulkRecovery).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "Apply Changes" }));
        await waitFor(() => expect(applyBulkRecovery).toHaveBeenCalledWith(1, body));
        await waitFor(() => expect(onApplied).toHaveBeenCalledTimes(1));
        expect(onClose).toHaveBeenCalled();
    });

    it("Restore Batch defaults and Remove manual prices are separate choices", async () => {
        setup();
        fireEvent.click(screen.getByRole("checkbox", { name: /Restore Batch defaults/ }));
        fireEvent.click(screen.getByRole("button", { name: "Preview" }));
        await waitFor(() => expect(previewBulkRecovery.mock.calls[0][1].restore_batch_defaults).toBe(true));
        expect(previewBulkRecovery.mock.calls[0][1].reset_fields).toEqual([]);
    });

    it("Remove manual prices clears all four", async () => {
        setup();
        fireEvent.click(screen.getByRole("checkbox", { name: "Remove manual prices" }));
        fireEvent.click(screen.getByRole("button", { name: "Preview" }));
        await waitFor(() => expect(previewBulkRecovery.mock.calls[0][1].reset_fields).toHaveLength(4));
    });

    it("says nothing changed when applying fails", async () => {
        applyBulkRecovery.mockRejectedValue(new CatalyticApiError("1 selected vehicle(s) are not in batch 1", { status: 400 }));
        const { onApplied } = setup();
        fireEvent.change(screen.getByLabelText("Scrap"), { target: { value: "true" } });
        fireEvent.click(screen.getByRole("button", { name: "Preview" }));
        fireEvent.click(await screen.findByRole("button", { name: "Apply Changes" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("Nothing was changed. 1 selected vehicle(s)");
        expect(onApplied).not.toHaveBeenCalled();
    });
});
