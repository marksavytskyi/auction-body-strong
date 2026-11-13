import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
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

    it("shows CatDB VIN and Our Database as two separate columns, never combined", async () => {
        listOperationsBatchVehicles.mockResolvedValue({
            items: [vehicle({ catdb_total_price: 300, ourdb_total_expected: 85 })],
            total: 1,
        });
        const { container } = render(<VehicleTable batchId={1} onOpenVehicle={vi.fn()} refreshKey={0} />);

        expect(await screen.findByRole("columnheader", { name: "CatDB VIN" })).toBeInTheDocument();
        expect(screen.getByRole("columnheader", { name: "Our Database" })).toBeInTheDocument();
        expect(container.querySelector('tbody [data-source="CATDB_VIN"]')).toHaveTextContent("$300.00");
        expect(container.querySelector('tbody [data-source="OUR_DATABASE"]')).toHaveTextContent("$85.00");
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

    it("sorts the Estimate column by the estimate it shows (known_components_subtotal)", async () => {
        listOperationsBatchVehicles.mockResolvedValue({ items: [vehicle()], total: 1 });
        render(<VehicleTable batchId={1} onOpenVehicle={vi.fn()} />);
        await waitFor(() => expect(listOperationsBatchVehicles).toHaveBeenCalledTimes(1));
        fireEvent.click(screen.getByRole("columnheader", { name: "Estimate" }));
        await waitFor(() =>
            expect(listOperationsBatchVehicles).toHaveBeenLastCalledWith(1, expect.objectContaining({ sortBy: "known_components_subtotal", sortDir: "asc" }))
        );
    });

    it("K.60: one Estimate column — no Complete Recovery / Known Subtotal pair, a partial says so and what is missing", async () => {
        listOperationsBatchVehicles.mockResolvedValue({
            items: [vehicle({
                financials: {
                    engine_value: 100, transmission_value: 50, cats_value: 130, cats_source: "CATDB_VIN", scrap_value: null,
                    known_components_subtotal: 280, total_expected_recovery: null,
                    completeness_status: "PARTIAL", components_available: 3, components_expected: 4, missing_components: ["scrap"],
                    recovery: { catalytic_source: "CATDB_VIN", valuation_mode: "MID", estimated: false, excluded_components: [], manual_components: [],
                        catalytic_label: "EXACT", catalytic_match_type: "VIN_EXACT", partial_price: true },
                },
            })],
            total: 1,
        });
        render(<VehicleTable batchId={1} onOpenVehicle={vi.fn()} />);
        await waitFor(() => expect(listOperationsBatchVehicles).toHaveBeenCalled());
        expect(screen.queryByRole("columnheader", { name: /complete recovery|known subtotal/i })).toBeNull();
        const table = screen.getByRole("columnheader", { name: "Estimate" }).closest("table");
        expect(within(table).getByText("$280.00")).toBeInTheDocument();
        expect(within(table).getAllByText("Partial Estimate").length).toBeGreaterThan(0);
        expect(within(table).getByText("Missing: Scrap")).toBeInTheDocument();
        expect(within(table).getByText("Partial price, check")).toBeInTheDocument();
        expect(within(table).getByText("Exact")).toBeInTheDocument();
    });

    it("K.60: an inferred CatDB Local price is labelled Inferred, and a confirmed $0 shows as $0.00", async () => {
        listOperationsBatchVehicles.mockResolvedValue({
            items: [vehicle({ id: 1, financials: {
                engine_value: 100, transmission_value: 50, cats_value: 120, cats_source: "CATDB_LOCAL", scrap_value: 20,
                known_components_subtotal: 290, total_expected_recovery: 290, completeness_status: "COMPLETE_WITH_ESTIMATES",
                missing_components: [],
                recovery: { catalytic_source: "CATDB_LOCAL", valuation_mode: "MID", estimated: true, excluded_components: [], manual_components: [],
                    catalytic_label: "INFERRED", catalytic_match_type: "CONFIGURATION_MATCH", partial_price: false },
            } }), vehicle({ id: 2, lot_number: "222", financials: {
                engine_value: 100, transmission_value: 50, cats_value: 0, cats_source: "CATDB_VIN", scrap_value: 20,
                known_components_subtotal: 170, total_expected_recovery: 170, completeness_status: "COMPLETE", missing_components: [],
                recovery: { catalytic_source: "CATDB_VIN", valuation_mode: "MID", estimated: false, excluded_components: [], manual_components: [],
                    catalytic_label: "EXACT", catalytic_match_type: "VIN_EXACT", partial_price: false },
            } })],
            total: 2,
        });
        render(<VehicleTable batchId={1} onOpenVehicle={vi.fn()} />);
        await waitFor(() => expect(listOperationsBatchVehicles).toHaveBeenCalled());
        const table = screen.getByRole("columnheader", { name: "Estimate" }).closest("table");
        expect(within(table).getByText("Inferred")).toBeInTheDocument();
        expect(within(table).getByText("$0.00")).toBeInTheDocument();
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

describe("VehicleTable price confidence tag (K.34)", () => {
    beforeEach(() => {
        listOperationsBatchVehicles.mockReset();
    });

    it("marks weak prices only", async () => {
        listOperationsBatchVehicles.mockResolvedValue({
            items: [vehicle({ engine_price_confidence: "LOW", transmission_price_confidence: "INSUFFICIENT_DATA" })],
            total: 1,
        });
        render(<VehicleTable batchId={1} onOpenVehicle={vi.fn()} refreshKey={0} />);
        // Once in the desktop table and once on the mobile card.
        expect(await screen.findAllByText("Low confidence")).toHaveLength(2);
        expect(screen.getAllByText("Too few listings")).toHaveLength(2);
    });

    it("adds nothing for strong prices or vehicles priced before K.34", async () => {
        listOperationsBatchVehicles.mockResolvedValue({
            items: [vehicle({ engine_price_confidence: "HIGH", transmission_price_confidence: "MEDIUM" }), vehicle({ id: 2 })],
            total: 2,
        });
        render(<VehicleTable batchId={1} onOpenVehicle={vi.fn()} refreshKey={0} />);
        await screen.findAllByText("$100.00");
        expect(screen.queryByText("Low confidence")).not.toBeInTheDocument();
        expect(screen.queryByText("Too few listings")).not.toBeInTheDocument();
    });
});

