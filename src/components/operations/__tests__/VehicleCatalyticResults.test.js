import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import VehicleCatalyticResults from "../VehicleCatalyticResults";
import { getOperationsVehicleCatalytic } from "@/lib/operations/api";

vi.mock("@/lib/operations/api", () => ({ getOperationsVehicleCatalytic: vi.fn() }));

describe("VehicleCatalyticResults", () => {
    it("keeps each source separate and labelled, with its own range and match", async () => {
        getOperationsVehicleCatalytic.mockResolvedValue({
            results: [
                { source: "CATDB_VIN", status: "NOT_REQUESTED" },
                {
                    source: "CATDB_LOCAL", status: "COMPLETED", match_type: "MAKE_MODEL_ANY_YEAR", confidence: "LOW",
                    price_low: "120", price_expected: "170", price_high: "220",
                    matched_record: { candidate_count: 2, vehicle_key_count: 1, top_candidates: [{ code: "C-1", probability: 0.5, price_avg: 170 }] },
                },
                { source: "ECOTRADE_LOCAL", status: "COMPLETED", match_type: "YEAR_MAKE_MODEL", confidence: "LOW", price_low: "140", price_expected: "190", price_high: "240" },
            ],
        });
        render(<VehicleCatalyticResults batchId={7} vehicleId={3} />);
        expect(await screen.findByText("CatDB Local Database")).toBeInTheDocument();
        expect(screen.getByText("EcoTrade Local Database")).toBeInTheDocument();
        expect(screen.getByText("Not requested")).toBeInTheDocument();
        expect(screen.getByText(/\$120\.00–\$220\.00/)).toBeInTheDocument();
        expect(screen.getByText(/\$140\.00–\$240\.00/)).toBeInTheDocument();
        expect(screen.getByText("C-1")).toBeInTheDocument();
        expect(screen.getByText(/make model any year · low confidence/i)).toBeInTheDocument();
        expect(getOperationsVehicleCatalytic).toHaveBeenCalledWith(7, 3);
    });

    it("shows no price for no match", async () => {
        getOperationsVehicleCatalytic.mockResolvedValue({ results: [{ source: "ECOTRADE_LOCAL", status: "NO_MATCH" }] });
        render(<VehicleCatalyticResults batchId={7} vehicleId={3} />);
        expect(await screen.findByText("No match")).toBeInTheDocument();
        expect(screen.queryByText(/estimate/)).toBeNull();
    });

    it("shows Our Database with the other sources, and only calls a reference match an estimate", async () => {
        getOperationsVehicleCatalytic.mockResolvedValue({
            results: [
                {
                    source: "OUR_DATABASE", status: "DONE", match_type: "OWN_SALES", confidence: "HIGH",
                    price_low: "400", price_expected: "500", price_high: "600",
                    matched_record: { sources_used: ["regime:our_observations"] },
                },
                { source: "CATDB_VIN", status: "NOT_REQUESTED" },
            ],
        });
        render(<VehicleCatalyticResults batchId={7} vehicleId={3} />);
        expect(await screen.findByText("Our Database")).toBeInTheDocument();
        expect(screen.getByText(/\$400\.00–\$600\.00/)).toBeInTheDocument();
        expect(screen.getByText(/own sales · high confidence/i)).toBeInTheDocument();
        expect(screen.queryByText("estimate")).toBeNull();
        expect(screen.getByText(/regime:our_observations/)).toBeInTheDocument();
    });
});

describe("K.60: the CatDB Local cache match in the vehicle detail", () => {
    it("shows the inferred match with its source VIN and job next to the stored result", async () => {
        getOperationsVehicleCatalytic.mockResolvedValue({ results: [{
            source: "CATDB_LOCAL", status: "COMPLETED", match_type: "MAKE_MODEL_ANY_YEAR", price_expected: "306.03",
            cache_match: { match_type: "CONFIGURATION_MATCH", confidence: "MEDIUM", price_low: "348.00", price_expected: "378.00",
                price_high: "408.00", matched_record: { source_vin: "JTDKN3DU3D5559303", source_job_id: 98 } },
        }] });
        render(<VehicleCatalyticResults batchId={21} vehicleId={1069} />);
        const box = await screen.findByTestId("cache-match");
        expect(box.textContent).toContain("Inferred from the CatDB Local cache: $378.00");
        expect(box.textContent).toContain("JTDKN3DU3D5559303");
        expect(box.textContent).toContain("job #98");
        expect(box.textContent).toContain("medium confidence");
        expect(screen.getByText("Expected $306.03")).toBeInTheDocument(); // the stored row is still shown as stored
    });
});
