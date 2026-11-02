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
    operations_batch_id: 20, rules_active: false, vehicles_evaluated: 44, vehicles_affected: 18, current_total: "42000.00", new_total: "44850.00",
    difference: "2850.00", catalytic_sources: { CATDB_VIN: 19, MISSING: 25 }, missing_values: 30, approximate_included: 1, uncertain_excluded: 2,
    completeness: { PARTIAL: 40, COMPLETE: 4 },
};

const open = async (batchId = 20) => {
    const onChanged = vi.fn();
    render(<BatchRecoverySettings batchId={batchId} onChanged={onChanged} />);
    fireEvent.click(screen.getByRole("button", { name: /Recovery Settings/ }));
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
        expect(within(dialog).getByText("$42,000.00")).toBeInTheDocument();
        expect(within(dialog).getByText("$44,850.00")).toBeInTheDocument();
        expect(within(dialog).getByText("+$2,850.00")).toBeInTheDocument();
        expect(within(dialog).getByText("18 of 44")).toBeInTheDocument();
        expect(within(dialog).queryByText("Batches affected")).not.toBeInTheDocument();
        expect(within(dialog).getByText(/saving changes no total yet/)).toBeInTheDocument();
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
        api.getBatchRecovery.mockResolvedValue({ ...BATCH, include_scrap: false, valuation_mode: "HIGH", allow_approximate: true });
        await open();
        expect(screen.getByRole("checkbox", { name: "Scrap" })).not.toBeChecked();
        expect(screen.getByRole("radio", { name: "HIGH" })).toBeChecked();
        expect(screen.getByRole("checkbox", { name: /Allow approximate/ })).toBeChecked();
    });

    it("Cancel restores the saved order; Reset to Default restores the default one", async () => {
        api.getBatchRecovery.mockResolvedValue({ ...BATCH, priority: [...PRIORITY].reverse() });
        await open();
        const first = () => screen.getAllByRole("listitem")[0];
        expect(first()).toHaveTextContent("EcoTrade Local");
        fireEvent.click(screen.getByRole("button", { name: "Reset to Default" }));
        expect(first()).toHaveTextContent("Our Database");
        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
        expect(first()).toHaveTextContent("EcoTrade Local");
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

describe("activation", () => {
    it("the collapsed header says whether this batch is active", async () => {
        api.getBatchRecovery.mockResolvedValue({ ...BATCH, rules_active: true, activated_at: "2026-11-01T10:00:00" });
        render(<BatchRecoverySettings batchId={20} />);
        expect(await screen.findByText("Rules active")).toBeInTheDocument();
    });

    it("shows this batch's dry run first, then activates only this batch", async () => {
        api.setBatchRecoveryActivation.mockResolvedValue({ ...BATCH, rules_active: true, activated_at: "2026-11-01T10:00:00", version: 3 });
        const onChanged = await open();
        fireEvent.click(screen.getByRole("button", { name: "Review and Activate" }));
        const dialog = await screen.findByRole("dialog", { name: "Activate the rules for Batch #20?" });
        expect(api.getBatchRecoveryDryRun).toHaveBeenCalledWith(20);
        expect(api.setBatchRecoveryActivation).not.toHaveBeenCalled();
        expect(within(dialog).getByText(/No other batch is affected, no search runs and no stored price changes/)).toBeInTheDocument();
        fireEvent.click(within(dialog).getByRole("button", { name: "Activate for This Batch" }));
        await waitFor(() => expect(api.setBatchRecoveryActivation).toHaveBeenCalledWith(20, { active: true, expectedVersion: 2 }));
        expect(await screen.findByText(/Batch #20 rules active/)).toBeInTheDocument();
        await waitFor(() => expect(onChanged).toHaveBeenCalled());
    });

    it("turning off asks first and needs no dry run", async () => {
        api.getBatchRecovery.mockResolvedValue({ ...BATCH, rules_active: true, activated_at: "2026-11-01T10:00:00" });
        api.setBatchRecoveryActivation.mockResolvedValue(BATCH);
        await open();
        fireEvent.click(screen.getByRole("button", { name: "Turn Off Rules" }));
        expect(api.getBatchRecoveryDryRun).not.toHaveBeenCalled();
        expect(screen.getByText("Turn off the rules for Batch #20?")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Turn Off" }));
        await waitFor(() => expect(api.setBatchRecoveryActivation).toHaveBeenCalledWith(20, { active: false, expectedVersion: 2 }));
    });

    it("can't activate over unsaved changes, so the dry run always matches what activates", async () => {
        await open();
        const button = screen.getByRole("button", { name: "Review and Activate" });
        expect(button).toBeEnabled();
        fireEvent.click(screen.getByRole("checkbox", { name: "Engine" }));
        expect(button).toBeDisabled();
        expect(screen.getByText("Save or cancel your changes first.")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
        expect(button).toBeEnabled();
    });

    it("a failed activation keeps the dialog open and leaves the batch inactive", async () => {
        api.setBatchRecoveryActivation.mockRejectedValue(new CatalyticApiError("These rules were changed by someone else.", { status: 409 }));
        await open();
        fireEvent.click(screen.getByRole("button", { name: "Review and Activate" }));
        fireEvent.click(await screen.findByRole("button", { name: "Activate for This Batch" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("changed by someone else");
        expect(screen.getByText(/Batch #20 rules not active/)).toBeInTheDocument();
    });
});
