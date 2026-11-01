import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import RecoverySettingsPage from "@/app/operations/recovery/page";
import BatchRecoverySettings from "../BatchRecoverySettings";
import RecoveryOverview from "../RecoveryOverview";
import * as api from "@/lib/operations/api";
import { CatalyticApiError } from "@/lib/catalytic/http";

vi.mock("@/lib/operations/api", () => ({
    getRecoverySettings: vi.fn(), previewRecoverySettings: vi.fn(), saveRecoverySettings: vi.fn(), getRecoveryDryRun: vi.fn(),
    setRecoveryActivation: vi.fn(), listRecoveryEvents: vi.fn(), getRecoverySummary: vi.fn(),
    getBatchRecovery: vi.fn(), previewBatchRecovery: vi.fn(), saveBatchRecovery: vi.fn(), resetBatchRecovery: vi.fn(),
    getScrapPrice: vi.fn(), setScrapPrice: vi.fn(),
}));
vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const PRIORITY = ["OUR_DATABASE", "CATDB_VIN", "CATDB_LOCAL", "ECOTRADE_LOCAL"].map((source) => ({ source, enabled: true }));
const RULES = {
    include_engine: true, include_transmission: true, include_scrap: true, include_catalytic: true,
    allow_approximate: false, valuation_mode: "MID", priority: PRIORITY,
};
const SETTINGS = { ...RULES, default_priority: PRIORITY, rules_active: false, activated_at: null, version: 2, updated_at: null };
const PREVIEW = {
    rules_active: false, vehicles_evaluated: 668, vehicles_affected: 184, batches_affected: 5, current_total: "420000.00", new_total: "448500.00",
    difference: "28500.00", catalytic_sources: { CATDB_VIN: 198, MISSING: 470 }, missing_values: 900, approximate_included: 12, uncertain_excluded: 42,
    completeness: { PARTIAL: 600, COMPLETE: 68 },
};

beforeEach(() => {
    vi.clearAllMocks();
    api.getRecoverySettings.mockResolvedValue(SETTINGS);
    api.listRecoveryEvents.mockResolvedValue({ items: [] });
    api.getScrapPrice.mockResolvedValue({ price: "0.0800", currency: "USD", weight_unit: "LB", version: 1, updated_at: "2026-11-01T10:00:00" });
    api.previewRecoverySettings.mockResolvedValue(PREVIEW);
    api.getRecoveryDryRun.mockResolvedValue(PREVIEW);
});

describe("Recovery Settings page", () => {
    it("preview comes before saving, and shows the backend's figures", async () => {
        api.saveRecoverySettings.mockResolvedValue({ ...SETTINGS, include_engine: false, version: 3 });
        render(<RecoverySettingsPage />);
        const engine = await screen.findByRole("checkbox", { name: "Engine" });
        expect(screen.getByRole("button", { name: "Preview Changes" })).toBeDisabled();
        fireEvent.click(engine);
        fireEvent.click(screen.getByRole("button", { name: "Preview Changes" }));
        await screen.findByRole("dialog", { name: "Preview recovery changes" });
        expect(api.saveRecoverySettings).not.toHaveBeenCalled();
        expect(screen.getByText("$420,000.00")).toBeInTheDocument();
        expect(screen.getByText("$448,500.00")).toBeInTheDocument();
        expect(screen.getByText("+$28,500.00")).toBeInTheDocument();
        expect(screen.getByText("184 of 668")).toBeInTheDocument();
        expect(screen.getByText("198 vehicles")).toBeInTheDocument();
        expect(screen.getByText(/saving changes no total yet/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Save Priority and Rules" }));
        await waitFor(() => expect(api.saveRecoverySettings).toHaveBeenCalledTimes(1));
        const sent = api.saveRecoverySettings.mock.calls[0][0];
        expect(sent.changes.include_engine).toBe(false);
        expect(sent.expectedVersion).toBe(2);
    });

    it("Cancel restores the saved order; Reset to Default restores the default one", async () => {
        api.getRecoverySettings.mockResolvedValue({ ...SETTINGS, priority: [...PRIORITY].reverse() });
        render(<RecoverySettingsPage />);
        await screen.findByRole("checkbox", { name: "Engine" });
        const first = () => screen.getAllByRole("listitem")[0];
        expect(first()).toHaveTextContent("EcoTrade Local");
        fireEvent.click(screen.getByRole("button", { name: "Reset to Default" }));
        expect(first()).toHaveTextContent("Our Database");
        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
        expect(first()).toHaveTextContent("EcoTrade Local");
    });

    it("can't preview with every source off", async () => {
        render(<RecoverySettingsPage />);
        for (const name of ["Our Database", "CatDB VIN Search", "CatDB Local", "EcoTrade Local"]) {
            fireEvent.click(await screen.findByRole("checkbox", { name }));
        }
        expect(screen.getByRole("button", { name: "Preview Changes" })).toBeDisabled();
    });

    it("activation shows the dry run first, then sends the version read", async () => {
        api.setRecoveryActivation.mockResolvedValue({ ...SETTINGS, rules_active: true, activated_at: "2026-11-01T10:00:00", version: 3 });
        render(<RecoverySettingsPage />);
        fireEvent.click(await screen.findByRole("button", { name: "Review and Activate" }));
        await screen.findByRole("dialog", { name: "Activate the recovery rules?" });
        expect(api.setRecoveryActivation).not.toHaveBeenCalled();
        expect(screen.getByText(/No search runs and no stored price changes/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Activate Rules" }));
        await waitFor(() => expect(api.setRecoveryActivation).toHaveBeenCalledWith({ active: true, expectedVersion: 2 }));
        expect(await screen.findByText(/Rules active/i)).toBeInTheDocument();
    });

    it("turning off asks first and needs no dry run", async () => {
        api.getRecoverySettings.mockResolvedValue({ ...SETTINGS, rules_active: true, activated_at: "2026-11-01T10:00:00" });
        api.setRecoveryActivation.mockResolvedValue(SETTINGS);
        render(<RecoverySettingsPage />);
        fireEvent.click(await screen.findByRole("button", { name: "Turn Off Rules" }));
        expect(api.getRecoveryDryRun).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "Turn Off" }));
        await waitFor(() => expect(api.setRecoveryActivation).toHaveBeenCalledWith({ active: false, expectedVersion: 2 }));
    });

    it("a save conflict stays open and reloads", async () => {
        api.saveRecoverySettings.mockRejectedValue(new CatalyticApiError("These rules were changed by someone else.", { status: 409 }));
        render(<RecoverySettingsPage />);
        fireEvent.click(await screen.findByRole("checkbox", { name: "Scrap" }));
        fireEvent.click(screen.getByRole("button", { name: "Preview Changes" }));
        fireEvent.click(await screen.findByRole("button", { name: "Save Priority and Rules" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("changed by someone else");
        expect(api.getRecoverySettings).toHaveBeenCalledTimes(2);
    });

    it("shows recent changes", async () => {
        api.listRecoveryEvents.mockResolvedValue({ items: [{ id: 1, action: "ACTIVATE", created_at: "2026-11-01T10:00:00", reason: "go" }] });
        render(<RecoverySettingsPage />);
        expect(await screen.findByText(/Rules activated · go/)).toBeInTheDocument();
    });
});

describe("BatchRecoverySettings", () => {
    const BATCH = {
        operations_batch_id: 20, rules_active: false, customized: false, own_rules: {}, effective: RULES,
        origin: {}, version: 0,
    };
    const open = async () => {
        const onChanged = vi.fn();
        render(<BatchRecoverySettings batchId={20} onChanged={onChanged} />);
        fireEvent.click(screen.getByRole("button", { name: /Recovery Settings/ }));
        await screen.findByRole("checkbox", { name: "Engine" });
        return onChanged;
    };

    beforeEach(() => {
        api.getBatchRecovery.mockResolvedValue(BATCH);
        api.previewBatchRecovery.mockResolvedValue(PREVIEW);
    });

    it("stays read-only until Customize, then previews before saving", async () => {
        api.saveBatchRecovery.mockResolvedValue({ ...BATCH, customized: true, version: 1 });
        const onChanged = await open();
        expect(screen.getByRole("checkbox", { name: "Engine" })).toBeDisabled();
        expect(screen.queryByRole("button", { name: "Reset Batch to Global Defaults" })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Customize This Batch" }));
        fireEvent.click(screen.getByRole("checkbox", { name: "Engine" }));
        fireEvent.click(screen.getByRole("button", { name: "Preview Changes" }));
        await screen.findByRole("dialog");
        expect(api.saveBatchRecovery).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "Apply Changes" }));
        await waitFor(() => expect(api.saveBatchRecovery).toHaveBeenCalledTimes(1));
        expect(api.saveBatchRecovery.mock.calls[0][1].changes.include_engine).toBe(false);
        expect(api.saveBatchRecovery.mock.calls[0][1].expectedVersion).toBe(0);
        await waitFor(() => expect(onChanged).toHaveBeenCalled());
    });

    it("Reset returns to the global settings after a preview", async () => {
        api.getBatchRecovery.mockResolvedValue({ ...BATCH, customized: true, version: 4 });
        api.resetBatchRecovery.mockResolvedValue(BATCH);
        await open();
        fireEvent.click(screen.getByRole("button", { name: "Reset Batch to Global Defaults" }));
        await waitFor(() => expect(api.previewBatchRecovery).toHaveBeenCalledWith(20, null, { reset: true }));
        fireEvent.click(await screen.findByRole("button", { name: "Apply Changes" }));
        await waitFor(() => expect(api.resetBatchRecovery).toHaveBeenCalledWith(20, { expectedVersion: 4 }));
    });
});

describe("RecoveryOverview", () => {
    it("labels the figure by whether the rules are active", async () => {
        api.getRecoverySummary.mockResolvedValue({ rules_active: false, recovery_total: "1288149.16", vehicles: 668, complete: 0, partial: 506, no_data: 162, batches: [] });
        const { unmount } = render(<RecoveryOverview />);
        expect(await screen.findByText("Known value, all batches")).toBeInTheDocument();
        expect(screen.getByText("$1,288,149.16")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Recovery Settings" })).toHaveAttribute("href", "/operations/recovery");
        unmount();
        api.getRecoverySummary.mockResolvedValue({ rules_active: true, recovery_total: "1.00", vehicles: 1, complete: 1, partial: 0, no_data: 0, batches: [] });
        render(<RecoveryOverview />);
        expect(await screen.findByText("Recovery Total, all batches")).toBeInTheDocument();
    });
});
