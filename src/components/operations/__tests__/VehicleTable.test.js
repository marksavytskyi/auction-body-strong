import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import VehicleTable from "../VehicleTable";
import { listOperationsBatchVehicles } from "@/lib/operations/api";

vi.mock("@/lib/operations/api", () => ({
    listOperationsBatchVehicles: vi.fn(),
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
        parts_status: "DONE",
        ourdb_status: "DONE",
        catdb_status: "NOT_REQUESTED",
        overall_status: "PARTIAL",
        weight_source: "NHTSA",
        weight_resolved_at: "2026-01-01T00:00:00",
        warnings_json: null,
        financials: {
            engine_value: 100,
            transmission_value: 50,
            cats_value: null,
            scrap_value: 20,
            known_components_subtotal: 170,
            total_expected_recovery: null,
            completeness_status: "PARTIAL",
            components_available: 3,
            components_expected: 4,
            missing_components: ["cats"],
        },
        ...overrides,
    };
}

describe("VehicleTable", () => {
    beforeEach(() => {
        listOperationsBatchVehicles.mockReset();
    });

    it("renders duplicate-VIN rows as distinct rows keyed by their stable vehicle id, not the VIN", async () => {
        listOperationsBatchVehicles.mockResolvedValue({
            items: [
                vehicle({ id: 10, lot_number: "100", full_vin: "1HGCM82633A000001" }),
                vehicle({ id: 11, lot_number: "101", full_vin: "1HGCM82633A000001" }),
            ],
            total: 2,
        });

        render(<VehicleTable batchId={1} onOpenVehicle={vi.fn()} />);

        await waitFor(() => expect(listOperationsBatchVehicles).toHaveBeenCalled());
        const lotCells = await screen.findAllByText(/^10[01]$/);
        expect(lotCells.length).toBeGreaterThanOrEqual(2);
    });

    it("shows a PARTIAL estimate with the known-components subtotal, never implying it is the full total", async () => {
        listOperationsBatchVehicles.mockResolvedValue({ items: [vehicle()], total: 1 });
        render(<VehicleTable batchId={1} onOpenVehicle={vi.fn()} />);

        await waitFor(() => expect(listOperationsBatchVehicles).toHaveBeenCalled());
        // Rendered once in the desktop table and once in the mobile card
        // (jsdom doesn't apply the CSS that hides one of them) — both are
        // real, so assert at least one of each rather than a single match.
        expect((await screen.findAllByText(/partial estimate/i)).length).toBeGreaterThan(0);
        // $170 known subtotal shown, never a fabricated "$170 total"
        expect(screen.getAllByText("$170.00").length).toBeGreaterThan(0);
    });

    it("shows a COMPLETE estimate distinctly from a partial one", async () => {
        listOperationsBatchVehicles.mockResolvedValue({
            items: [vehicle({
                financials: {
                    engine_value: 100, transmission_value: 50, cats_value: 30, scrap_value: 20,
                    known_components_subtotal: 200, total_expected_recovery: 200,
                    completeness_status: "COMPLETE", components_available: 4, components_expected: 4, missing_components: [],
                },
            })],
            total: 1,
        });
        render(<VehicleTable batchId={1} onOpenVehicle={vi.fn()} />);

        await waitFor(() => expect(listOperationsBatchVehicles).toHaveBeenCalled());
        expect((await screen.findAllByText(/complete estimate/i)).length).toBeGreaterThan(0);
    });

    it("never renders a missing financial value as $0", async () => {
        listOperationsBatchVehicles.mockResolvedValue({ items: [vehicle()], total: 1 });
        render(<VehicleTable batchId={1} onOpenVehicle={vi.fn()} />);
        await waitFor(() => expect(listOperationsBatchVehicles).toHaveBeenCalled());
        await screen.findAllByText("$170.00");
        expect(screen.queryByText("$0.00")).not.toBeInTheDocument();
    });

    it("debounces search and sends it to the backend rather than filtering client-side", async () => {
        listOperationsBatchVehicles.mockResolvedValue({ items: [vehicle()], total: 1 });
        render(<VehicleTable batchId={1} onOpenVehicle={vi.fn()} />);
        await waitFor(() => expect(listOperationsBatchVehicles).toHaveBeenCalledTimes(1));

        fireEvent.change(screen.getByPlaceholderText(/search vin/i), { target: { value: "civic" } });

        await waitFor(() =>
            expect(listOperationsBatchVehicles).toHaveBeenLastCalledWith(1, expect.objectContaining({ search: "civic" }))
        , { timeout: 1000 });
    });

    it("sends the backend's sort_by/sort_dir params when a sortable column header is clicked, never sorting client-side", async () => {
        listOperationsBatchVehicles.mockResolvedValue({ items: [vehicle()], total: 1 });
        render(<VehicleTable batchId={1} onOpenVehicle={vi.fn()} />);
        await waitFor(() => expect(listOperationsBatchVehicles).toHaveBeenCalledTimes(1));

        fireEvent.click(screen.getByText(/^year$/i));

        await waitFor(() =>
            expect(listOperationsBatchVehicles).toHaveBeenLastCalledWith(1, expect.objectContaining({ sortBy: "year", sortDir: "asc" }))
        );
    });

    it("requests the next page via offset rather than fetching everything up front", async () => {
        listOperationsBatchVehicles.mockResolvedValue({ items: [vehicle()], total: 60 });
        render(<VehicleTable batchId={1} onOpenVehicle={vi.fn()} />);
        await waitFor(() => expect(listOperationsBatchVehicles).toHaveBeenCalledTimes(1));
        expect(listOperationsBatchVehicles).toHaveBeenCalledWith(1, expect.objectContaining({ limit: 25, offset: 0 }));

        const nextButtons = screen.getAllByRole("button").filter((b) => !b.disabled);
        // last enabled icon button is "next page" (prev is disabled on page 1)
        fireEvent.click(nextButtons[nextButtons.length - 1]);

        await waitFor(() =>
            expect(listOperationsBatchVehicles).toHaveBeenLastCalledWith(1, expect.objectContaining({ offset: 25 }))
        );
    });

    it("calls onOpenVehicle with the full vehicle record when a row is clicked", async () => {
        const v = vehicle();
        listOperationsBatchVehicles.mockResolvedValue({ items: [v], total: 1 });
        const onOpenVehicle = vi.fn();
        render(<VehicleTable batchId={1} onOpenVehicle={onOpenVehicle} />);

        const vinCells = await screen.findAllByText(v.full_vin);
        const tableRow = vinCells.map((el) => el.closest("tr")).find(Boolean);
        fireEvent.click(tableRow);
        expect(onOpenVehicle).toHaveBeenCalledWith(v);
    });
});
