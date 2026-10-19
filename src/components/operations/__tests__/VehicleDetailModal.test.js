import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import VehicleDetailModal from "../VehicleDetailModal";

vi.mock("@/lib/operations/api", () => ({
    setOperationsVehicleWeight: vi.fn(),
    setOperationsVehicleScrapOverride: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
    default: { success: vi.fn(), error: vi.fn() },
}));

function vehicle(overrides = {}) {
    return {
        id: 1,
        operations_batch_id: 1,
        lot_number: "100",
        full_vin: "1HGCM82633A000001",
        year: "2015",
        make: "Honda",
        model: "Civic",
        row_valid: true,
        parts_status: "DONE",
        ourdb_status: "DONE",
        catdb_status: "NOT_REQUESTED",
        overall_status: "PARTIAL",
        warnings_json: null,
        financials: {
            engine_value: 100, transmission_value: 50, cats_value: null, scrap_value: 20,
            known_components_subtotal: 170, total_expected_recovery: null,
            completeness_status: "PARTIAL", components_available: 3, components_expected: 4, missing_components: ["cats"],
        },
        ...overrides,
    };
}

describe("VehicleDetailModal weight status", () => {
    it("shows Pending when weight_resolved_at is absent", () => {
        render(<VehicleDetailModal vehicle={vehicle({ weight_resolved_at: null, curb_weight_lb: null, weight_source: "UNKNOWN" })} onClose={vi.fn()} />);
        expect(screen.getByText(/^pending$/i)).toBeInTheDocument();
    });

    it("shows the terminal No Data when weight_resolved_at is set but no curb weight was found", () => {
        render(<VehicleDetailModal vehicle={vehicle({ weight_resolved_at: "2026-01-01T00:00:00", curb_weight_lb: null, weight_source: "UNKNOWN" })} onClose={vi.fn()} />);
        expect(screen.getByText(/^no data$/i)).toBeInTheDocument();
        expect(screen.getByText(/terminal, not pending/i)).toBeInTheDocument();
    });

    it("shows NHTSA when a real curb weight was resolved", () => {
        render(<VehicleDetailModal vehicle={vehicle({ weight_resolved_at: "2026-01-01T00:00:00", curb_weight_lb: 3500, weight_source: "NHTSA" })} onClose={vi.fn()} />);
        // Rendered twice: the status pill (derived) and the raw "Source" row — both real, both NHTSA.
        expect(screen.getAllByText(/^nhtsa$/i).length).toBeGreaterThanOrEqual(2);
    });
});
