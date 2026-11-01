import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import RecoveryPriceBuilder from "../RecoveryPriceBuilder";
import { getVehicleRecovery, previewVehicleRecovery, resetVehicleRecovery, saveVehicleRecovery } from "@/lib/operations/api";
import { CatalyticApiError } from "@/lib/catalytic/http";

vi.mock("@/lib/operations/api", () => ({
    getVehicleRecovery: vi.fn(),
    previewVehicleRecovery: vi.fn(),
    saveVehicleRecovery: vi.fn(),
    resetVehicleRecovery: vi.fn(),
}));
vi.mock("@/lib/catalytic/catdbAdmin", () => ({}));
vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn() } }));

function component(name, price, overrides = {}) {
    return {
        name, included: true, included_origin: "GLOBAL", state: "AVAILABLE", effective_price: price, automatic_price: price,
        manual_price: null, is_manual: false, source: name === "scrap" ? "GLOBAL_SCRAP_PRICE" : "PARTS_PRICING", ...overrides,
    };
}

function option(source, overrides = {}) {
    return {
        source, status: "NOT_REQUESTED", available: false, exact: false, match_type: null, confidence: null, low: null, mid: null,
        high: null, value: null, uncertain: null, enabled_in_priority: true, candidates: [], candidate_count: 0, ...overrides,
    };
}

function view(overrides = {}) {
    return {
        operations_batch_vehicle_id: 2, rules_active: true, version: 3,
        components: [
            component("engine", "1850.00"), component("transmission", "920.00"),
            component("scrap", "240.00"), component("catalytic", "225.00", { source: "CATDB_VIN" }),
        ],
        scrap_rate: "0.0800", recovery_total: "3235.00", completeness: "COMPLETE", missing_components: [],
        included_components: ["engine", "transmission", "scrap", "catalytic"],
        catalytic: {
            selected_source: null, candidate_code: null, effective_source: "CATDB_VIN", valuation_mode: "MID",
            valuation_mode_origin: "GLOBAL", allow_approximate: false, allow_approximate_origin: "GLOBAL",
            approximate: false, uncertain: false, reason: null, skipped: [],
            options: [
                option("OUR_DATABASE"),
                option("CATDB_VIN", { status: "DONE", available: true, exact: true, match_type: "VIN_EXACT", low: "180.00", mid: "225.00", high: "270.00", value: "225.00" }),
                option("CATDB_LOCAL"),
                option("ECOTRADE_LOCAL"),
            ],
        },
        ...overrides,
    };
}

async function setup() {
    const onSaved = vi.fn();
    render(<RecoveryPriceBuilder batchId={1} vehicleId={2} onSaved={onSaved} />);
    await screen.findByTestId("recovery-total");
    return onSaved;
}

describe("RecoveryPriceBuilder", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getVehicleRecovery.mockResolvedValue(view());
    });

    it("shows each component, its source, the Scrap rate and the total", async () => {
        await setup();
        expect(screen.getByText("$1,850.00")).toBeInTheDocument();
        expect(screen.getByTestId("recovery-total")).toHaveTextContent("$3,235.00");
        expect(screen.getByText(/Global Scrap Price · \$0\.08\/lb/)).toBeInTheDocument();
        expect(screen.getByText("Missing components: None")).toBeInTheDocument();
    });

    it("unchecking a component asks the backend for the new total and saves nothing", async () => {
        previewVehicleRecovery.mockResolvedValue(view({
            recovery_total: "1385.00",
            components: [component("engine", "1850.00", { included: false, state: "EXCLUDED" }), component("transmission", "920.00"), component("scrap", "240.00"), component("catalytic", "225.00")],
        }));
        await setup();
        fireEvent.click(screen.getByRole("checkbox", { name: "Include Engine" }));
        await waitFor(() => expect(previewVehicleRecovery).toHaveBeenCalledWith(1, 2, { include_engine: false }));
        await waitFor(() => expect(screen.getByTestId("recovery-total")).toHaveTextContent("$1,385.00"));
        expect(screen.getByText("$1,850.00")).toHaveClass("line-through"); // the price is kept
        expect(saveVehicleRecovery).not.toHaveBeenCalled();
    });

    it("saves the draft once, with the version read and the optional reason", async () => {
        previewVehicleRecovery.mockResolvedValue(view());
        saveVehicleRecovery.mockResolvedValue(view({ version: 4 }));
        const onSaved = await setup();
        fireEvent.click(screen.getByRole("radio", { name: "LOW" }));
        await waitFor(() => expect(previewVehicleRecovery).toHaveBeenCalled());
        await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeEnabled());
        fireEvent.change(screen.getByLabelText("Reason, optional"), { target: { value: " quote " } });
        fireEvent.click(screen.getByRole("button", { name: "Save" }));
        fireEvent.click(screen.getByRole("button", { name: "Save" }));
        await waitFor(() => expect(saveVehicleRecovery).toHaveBeenCalledTimes(1));
        expect(saveVehicleRecovery).toHaveBeenCalledWith(1, 2, { changes: { valuation_mode: "LOW" }, expectedVersion: 3, reason: "quote" });
        await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    });

    it("a manual price goes as text, supports zero, and bad text never reaches the backend", async () => {
        previewVehicleRecovery.mockResolvedValue(view());
        await setup();
        fireEvent.click(screen.getAllByRole("button", { name: "Override" })[0]);
        fireEvent.change(screen.getByLabelText("Manual Engine price"), { target: { value: "-5" } });
        expect(await screen.findByRole("alert")).toHaveTextContent("Enter dollars and cents");
        expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
        await new Promise((resolve) => { setTimeout(resolve, 200); });
        expect(previewVehicleRecovery).not.toHaveBeenCalled();
        fireEvent.change(screen.getByLabelText("Manual Engine price"), { target: { value: "0" } });
        await waitFor(() => expect(previewVehicleRecovery).toHaveBeenCalledWith(1, 2, { engine_manual_price: "0" }));
    });

    it("shows a manual price with the automatic one beside it and can restore it", async () => {
        getVehicleRecovery.mockResolvedValue(view({
            components: [
                component("engine", "1600.00", { automatic_price: "1850.00", manual_price: "1600.00", is_manual: true, source: "MANUAL" }),
                component("transmission", "920.00"), component("scrap", "240.00"), component("catalytic", "225.00"),
            ],
        }));
        previewVehicleRecovery.mockResolvedValue(view());
        await setup();
        expect(screen.getByText("Manual override")).toBeInTheDocument();
        expect(screen.getByText(/automatic \$1,850\.00/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Restore Automatic" }));
        await waitFor(() => expect(previewVehicleRecovery).toHaveBeenCalledWith(1, 2, { engine_manual_price: null }));
    });

    it("selecting a source sends it, and an unavailable source can't be selected", async () => {
        previewVehicleRecovery.mockResolvedValue(view());
        await setup();
        expect(screen.getByRole("radio", { name: /Our Database/ })).toBeDisabled();
        fireEvent.click(screen.getByRole("radio", { name: /^CatDB VIN Search/ }));
        await waitFor(() => expect(previewVehicleRecovery).toHaveBeenCalledWith(1, 2, { catalytic_source: "CATDB_VIN" }));
    });

    it("labels a flagged price and explains why it was passed over", async () => {
        const base = view();
        getVehicleRecovery.mockResolvedValue(view({
            completeness: "PARTIAL", recovery_total: "3010.00", missing_components: ["catalytic"],
            catalytic: {
                ...base.catalytic, effective_source: "MISSING", reason: "No eligible catalytic source",
                skipped: [{ source: "CATDB_VIN", reason: "UNCERTAIN" }],
                options: [option("OUR_DATABASE"), option("CATDB_VIN", { available: true, status: "DONE", exact: true, uncertain: "UNRECOGNIZED_PRICE_FORMAT", value: "225.00" }), option("CATDB_LOCAL"), option("ECOTRADE_LOCAL")],
            },
        }));
        await setup();
        expect(screen.getByText(/Needs review, so never used automatically: UNRECOGNIZED/)).toBeInTheDocument();
        expect(screen.getByText("Incomplete: missing Catalytic")).toBeInTheDocument();
        expect(screen.getByText(/price needs review/)).toBeInTheDocument();
    });

    it("labels an approximate match as estimated, and offers one converter from a catalog", async () => {
        const base = view();
        getVehicleRecovery.mockResolvedValue(view({
            catalytic: {
                ...base.catalytic, selected_source: "ECOTRADE_LOCAL", effective_source: "ECOTRADE_LOCAL", approximate: true,
                options: [option("ECOTRADE_LOCAL", {
                    available: true, status: "COMPLETED", match_type: "MAKE_MODEL_ANY_YEAR", low: "10.00", high: "300.00", value: "155.00", candidate_count: 2,
                    candidates: [{ code: "A1", price_low: 10, price_high: 20 }, { code: "B2", price_low: 100, price_high: 300 }],
                })],
            },
        }));
        previewVehicleRecovery.mockResolvedValue(view());
        await setup();
        expect(screen.getByText("Estimated match, not an exact one")).toBeInTheDocument();
        expect(screen.getByText(/Model only/)).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText("Converter"), { target: { value: "B2" } });
        await waitFor(() => expect(previewVehicleRecovery).toHaveBeenCalledWith(1, 2, { catalytic_candidate_code: "B2" }));
    });

    it("says when the rules are not active yet", async () => {
        getVehicleRecovery.mockResolvedValue(view({ rules_active: false }));
        await setup();
        expect(screen.getByText(/rules are not active yet/)).toBeInTheDocument();
    });

    it("Reset to Batch Rules asks first", async () => {
        resetVehicleRecovery.mockResolvedValue(view({ version: 4 }));
        await setup();
        fireEvent.click(screen.getByRole("button", { name: "Reset to Batch Rules" }));
        expect(resetVehicleRecovery).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "Reset" }));
        await waitFor(() => expect(resetVehicleRecovery).toHaveBeenCalledWith(1, 2, { expectedVersion: 3 }));
    });

    it("a slower earlier preview never replaces a newer one", async () => {
        const answers = [];
        previewVehicleRecovery.mockImplementation(() => new Promise((resolve) => answers.push(resolve)));
        await setup();
        fireEvent.click(screen.getByRole("radio", { name: "LOW" }));
        await waitFor(() => expect(answers).toHaveLength(1));
        fireEvent.click(screen.getByRole("radio", { name: "HIGH" }));
        await waitFor(() => expect(answers).toHaveLength(2));
        await act(async () => { answers[1](view({ recovery_total: "2.00" })); });
        await act(async () => { answers[0](view({ recovery_total: "1.00" })); });
        expect(screen.getByTestId("recovery-total")).toHaveTextContent("$2.00");
    });

    it("a conflict reloads what is saved", async () => {
        previewVehicleRecovery.mockResolvedValue(view());
        saveVehicleRecovery.mockRejectedValue(new CatalyticApiError("changed", { status: 409 }));
        await setup();
        fireEvent.click(screen.getByRole("radio", { name: "LOW" }));
        await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeEnabled());
        fireEvent.click(screen.getByRole("button", { name: "Save" }));
        await waitFor(() => expect(getVehicleRecovery).toHaveBeenCalledTimes(2));
    });
});
