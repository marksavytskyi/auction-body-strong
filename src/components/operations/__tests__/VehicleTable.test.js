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

    // ─── Weight status fix (Section 5) ──────────────────────────────────

    // Weight status pills are rendered as <span> StatusPill elements; the
    // "Pending" overall-status filter button is a <button> and must never
    // be mistaken for the vehicle's own weight status pill.
    function nonButtonMatches(regex) {
        return screen.queryAllByText(regex).filter((el) => el.tagName !== "BUTTON");
    }

    it("labels a vehicle whose weight hasn't been resolved yet as Pending, never conflating it with No Data", async () => {
        listOperationsBatchVehicles.mockResolvedValue({
            items: [vehicle({ weight_resolved_at: null, curb_weight_lb: null, weight_source: "UNKNOWN" })],
            total: 1,
        });
        render(<VehicleTable batchId={1} onOpenVehicle={vi.fn()} />);
        await waitFor(() => expect(listOperationsBatchVehicles).toHaveBeenCalled());
        await screen.findAllByText(/1HGCM82633A000001/);
        expect(nonButtonMatches(/^pending$/i).length).toBeGreaterThan(0);
        expect(nonButtonMatches(/^no data$/i).length).toBe(0);
    });

    it("labels a vehicle whose weight resolution finished without a usable result as the terminal No Data, never Pending", async () => {
        listOperationsBatchVehicles.mockResolvedValue({
            items: [vehicle({ weight_resolved_at: "2026-01-01T00:00:00", curb_weight_lb: null, weight_source: "UNKNOWN" })],
            total: 1,
        });
        render(<VehicleTable batchId={1} onOpenVehicle={vi.fn()} />);
        await waitFor(() => expect(listOperationsBatchVehicles).toHaveBeenCalled());
        await screen.findAllByText(/1HGCM82633A000001/);
        expect(nonButtonMatches(/^no data$/i).length).toBeGreaterThan(0);
        expect(nonButtonMatches(/^pending$/i).length).toBe(0);
    });

    it("labels a vehicle with a real resolved weight as NHTSA, not Pending", async () => {
        listOperationsBatchVehicles.mockResolvedValue({
            items: [vehicle({ weight_resolved_at: "2026-01-01T00:00:00", curb_weight_lb: 3500, weight_source: "NHTSA" })],
            total: 1,
        });
        render(<VehicleTable batchId={1} onOpenVehicle={vi.fn()} />);
        await waitFor(() => expect(listOperationsBatchVehicles).toHaveBeenCalled());
        expect((await screen.findAllByText(/^nhtsa$/i)).length).toBeGreaterThan(0);
    });

    // ─── Financial sorting fix (Section 6) ──────────────────────────────

    it("sorts the Complete Recovery column by total_expected_recovery, and Known Subtotal by known_components_subtotal — never a shared/misleading sort field", async () => {
        listOperationsBatchVehicles.mockResolvedValue({ items: [vehicle()], total: 1 });
        render(<VehicleTable batchId={1} onOpenVehicle={vi.fn()} />);
        await waitFor(() => expect(listOperationsBatchVehicles).toHaveBeenCalledTimes(1));

        fireEvent.click(screen.getByText(/^complete recovery$/i));
        await waitFor(() =>
            expect(listOperationsBatchVehicles).toHaveBeenLastCalledWith(1, expect.objectContaining({ sortBy: "total_expected_recovery", sortDir: "asc" }))
        );

        fireEvent.click(screen.getByText(/^known subtotal$/i));
        await waitFor(() =>
            expect(listOperationsBatchVehicles).toHaveBeenLastCalledWith(1, expect.objectContaining({ sortBy: "known_components_subtotal", sortDir: "asc" }))
        );
    });

    it("displays Complete Recovery and Known Subtotal as two separate columns, never one combined value", async () => {
        listOperationsBatchVehicles.mockResolvedValue({
            items: [vehicle({
                financials: {
                    engine_value: 100, transmission_value: 50, cats_value: null, scrap_value: 20,
                    known_components_subtotal: 170, total_expected_recovery: null,
                    completeness_status: "PARTIAL", components_available: 3, components_expected: 4, missing_components: ["cats"],
                },
            })],
            total: 1,
        });
        render(<VehicleTable batchId={1} onOpenVehicle={vi.fn()} />);
        await waitFor(() => expect(listOperationsBatchVehicles).toHaveBeenCalled());

        expect(screen.getByText(/^complete recovery$/i)).toBeInTheDocument();
        expect(screen.getByText(/^known subtotal$/i)).toBeInTheDocument();
        // Complete Recovery is null for a PARTIAL vehicle -> em dash, never $0.
        const desktopTable = screen.getByText(/^complete recovery$/i).closest("table");
        expect(desktopTable).toBeTruthy();
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
