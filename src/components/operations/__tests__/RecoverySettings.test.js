import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import BatchRecoverySettings from "../BatchRecoverySettings";
import * as api from "@/lib/operations/api";
import { CatalyticApiError } from "@/lib/catalytic/http";

vi.mock("@/lib/operations/api", () => ({
    getBatchRecovery: vi.fn(), previewBatchRecovery: vi.fn(), saveBatchRecovery: vi.fn(),
    getBatchRecoveryDryRun: vi.fn(), setBatchRecoveryActivation: vi.fn(), listRecoveryEvents: vi.fn(),
}));
vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const PRIORITY = ["OUR_DATABASE", "CATDB_VIN", "CATDB_LOCAL", "ECOTRADE_LOCAL"].map((source) => ({ source, enabled: true }));
const BATCH = {
    operations_batch_id: 20, include_engine: true, include_transmission: true, include_scrap: true, include_catalytic: true,
    allow_approximate: false, valuation_mode: "MID", priority: PRIORITY, default_priority: PRIORITY,
    rules_active: false, activated_at: null, version: 2, updated_at: null,
};
const PREVIEW = {
    operations_batch_id: 20, rules_active: true, vehicles_evaluated: 44, vehicles_affected: 18,
    catalytic_sources: { CATDB_VIN: 19, MISSING: 25 }, missing_values: 30, approximate_included: 1, partial_prices_included: 2,
    completeness: { PARTIAL: 40, COMPLETE: 4 },
};

const open = async (batchId = 20) => {
    const onChanged = vi.fn();
    render(<BatchRecoverySettings batchId={batchId} onChanged={onChanged} />);
    fireEvent.click(screen.getByRole("button", { name: /Vehicle Estimate Settings/ }));
    await screen.findByRole("checkbox", { name: "Engine" });
    return onChanged;
};

beforeEach(() => {
    vi.clearAllMocks();
    api.getBatchRecovery.mockResolvedValue(BATCH);
    api.previewBatchRecovery.mockResolvedValue(PREVIEW);
    api.getBatchRecoveryDryRun.mockResolvedValue(PREVIEW);
    api.listRecoveryEvents.mockResolvedValue({ items: [] });
});

describe("BatchRecoverySettings", () => {
    it("has no global options left", async () => {
        await open();
        for (const name of ["Customize This Batch", "Reset Batch to Global Defaults"]) {
            expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
        }
        expect(screen.queryByText(/global settings/i)).not.toBeInTheDocument();
    });

    it("is editable straight away, and previews before saving this batch", async () => {
        api.saveBatchRecovery.mockResolvedValue({ ...BATCH, include_engine: false, version: 3 });
        const onChanged = await open();
        const engine = screen.getByRole("checkbox", { name: "Engine" });
        expect(engine).toBeEnabled();
        expect(screen.getByRole("button", { name: "Preview Changes" })).toBeDisabled();
        fireEvent.click(engine);
        fireEvent.click(screen.getByRole("button", { name: "Preview Changes" }));
        const dialog = await screen.findByRole("dialog", { name: "Preview changes to Batch #20" });
        expect(api.previewBatchRecovery.mock.calls[0][0]).toBe(20);
        expect(api.saveBatchRecovery).not.toHaveBeenCalled();
        // K.60 — per-vehicle counts only, never a batch total.
        expect(within(dialog).getByText("18 of 44")).toBeInTheDocument();
        expect(within(dialog).getByText("Estimates that change")).toBeInTheDocument();
        expect(within(dialog).queryByText(/Current total|New total|Difference/)).not.toBeInTheDocument();
        expect(within(dialog).queryByText(/\$/)).not.toBeInTheDocument();
        fireEvent.click(within(dialog).getByRole("button", { name: "Save Rules" }));
        await waitFor(() => expect(api.saveBatchRecovery).toHaveBeenCalledTimes(1));
        const [batchId, sent] = api.saveBatchRecovery.mock.calls[0];
        expect(batchId).toBe(20);
        expect(sent.changes.include_engine).toBe(false);
        expect(sent.expectedVersion).toBe(2);
        await waitFor(() => expect(onChanged).toHaveBeenCalled());
    });

    it("each batch loads and saves only its own rules", async () => {
        await open(17);
        expect(api.getBatchRecovery).toHaveBeenCalledWith(17);
        expect(api.getBatchRecovery).not.toHaveBeenCalledWith(20);
        expect(api.listRecoveryEvents).toHaveBeenCalledWith({ batchId: 17 });
    });

    it("shows the saved rules of the batch, not defaults", async () => {
        api.getBatchRecovery.mockResolvedValue({ ...BATCH, include_scrap: false, valuation_mode: "HIGH",
            priority: PRIORITY.map((e) => (e.source === "CATDB_VIN" ? { ...e, enabled: false } : e)) });
        await open();
        expect(screen.getByRole("checkbox", { name: "Scrap" })).not.toBeChecked();
        expect(screen.getByRole("radio", { name: "HIGH" })).toBeChecked();
        // Batch 21 style: a source switched off stays off.
        expect(screen.getByRole("checkbox", { name: "CatDB VIN Search" })).not.toBeChecked();
        // K.60 — approximate prices always count (labelled): no switch for it.
        expect(screen.queryByRole("checkbox", { name: /Allow approximate/ })).not.toBeInTheDocument();
    });

    it("shows the fixed order whatever order was saved (Batch 22 style), with no way to reorder", async () => {
        api.getBatchRecovery.mockResolvedValue({ ...BATCH, priority: [PRIORITY[0], PRIORITY[2], PRIORITY[3], PRIORITY[1]] });
        await open();
        const items = screen.getAllByRole("listitem").map((li) => li.textContent);
        expect(items).toEqual(["1Our Database", "2CatDB VIN Search", "3CatDB Local", "4EcoTrade Local"]);
        expect(screen.queryByRole("button", { name: /Move .* up|Reorder/ })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Reset to Default" })).not.toBeInTheDocument();
    });

    it("Turn all on switches every source back on; Cancel restores the saved switches", async () => {
        api.getBatchRecovery.mockResolvedValue({ ...BATCH, priority: PRIORITY.map((e) => (e.source === "CATDB_VIN" ? { ...e, enabled: false } : e)) });
        await open();
        const vin = () => screen.getByRole("checkbox", { name: "CatDB VIN Search" });
        expect(vin()).not.toBeChecked();
        fireEvent.click(screen.getByRole("button", { name: "Turn all on" }));
        expect(vin()).toBeChecked();
        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
        expect(vin()).not.toBeChecked();
    });

    it("can't preview with every source off", async () => {
        await open();
        for (const name of ["Our Database", "CatDB VIN Search", "CatDB Local", "EcoTrade Local"]) {
            fireEvent.click(screen.getByRole("checkbox", { name }));
        }
        expect(screen.getByRole("button", { name: "Preview Changes" })).toBeDisabled();
    });

    it("a save conflict stays open and reloads", async () => {
        api.saveBatchRecovery.mockRejectedValue(new CatalyticApiError("These rules were changed by someone else.", { status: 409 }));
        await open();
        fireEvent.click(screen.getByRole("checkbox", { name: "Scrap" }));
        fireEvent.click(screen.getByRole("button", { name: "Preview Changes" }));
        fireEvent.click(await screen.findByRole("button", { name: "Save Rules" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("changed by someone else");
        expect(api.getBatchRecovery).toHaveBeenCalledTimes(2);
    });

    it("shows this batch's recent changes", async () => {
        api.listRecoveryEvents.mockResolvedValue({ items: [{ id: 1, action: "ACTIVATE", created_at: "2026-11-01T10:00:00", reason: "go" }] });
        await open();
        expect(await screen.findByText(/Rules activated · go/)).toBeInTheDocument();
    });
});

describe("K.60: no activation", () => {
    it("has no activation switch and no Rules active / not active label: the rules always apply", async () => {
        render(<BatchRecoverySettings batchId={20} />);
        expect(await screen.findByRole("button", { name: /Vehicle Estimate Settings/ })).toBeInTheDocument();
        expect(screen.queryByText(/Rules active|Rules not active/)).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: /Vehicle Estimate Settings/ }));
        await screen.findByRole("checkbox", { name: "Engine" });
        expect(screen.queryByRole("button", { name: /Review and Activate|Turn Off Rules/ })).not.toBeInTheDocument();
    });
});
