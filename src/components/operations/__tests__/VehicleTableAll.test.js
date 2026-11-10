import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import VehicleTable from "../VehicleTable";
import { listOperationsBatchVehicles } from "@/lib/operations/api";
import { ALL_CHUNK_SIZE } from "@/lib/pagination";

vi.mock("@/lib/operations/api", () => ({ listOperationsBatchVehicles: vi.fn() }));

// The test DOM takes seconds to draw hundreds of rows twice (table and phone cards),
// so most tests here use 20-row chunks. One test below runs the real 200 on 437 rows.
const CHUNK = vi.hoisted(() => ({ size: 20 }));
vi.mock("@/lib/pagination", async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, get ALL_CHUNK_SIZE() { return CHUNK.size; } };
});

// Phase K.48 — All shows every vehicle matching the filters, search and sort, loaded
// from the server in chunks, never more than ALL_CHUNK_SIZE at a time.

const MAKES = ["Honda", "Ford", "Toyota"];
const vehicle = (id) => ({
    id, operations_batch_id: 1, lot_number: String(1000 + id), full_vin: `TESTVIN${String(id).padStart(10, "0")}`,
    year: String(2000 + (id % 20)), make: MAKES[id % 3], model: "Model", overall_status: id % 5 === 0 ? "FAILED" : "PARTIAL",
    parts_status: "DONE", ourdb_status: "DONE", catdb_status: "NOT_REQUESTED", warnings_json: null,
    financials: { engine_value: 100, transmission_value: 50, cats_value: null, known_components_subtotal: 150, total_expected_recovery: null, completeness_status: "PARTIAL" },
});

// Filters, searches, sorts and pages like the backend: id is the last sort key.
function serve(vehicles) {
    listOperationsBatchVehicles.mockImplementation(async (_batchId, { limit, offset, search, status, sortBy, sortDir }) => {
        let rows = vehicles.filter((v) => (!status || v.overall_status === status)
            && (!search || [v.full_vin, v.lot_number, v.year, v.make, v.model].join(" ").toLowerCase().includes(search.toLowerCase())));
        const key = sortBy === "source_row_number" ? "id" : sortBy;
        rows = [...rows].sort((a, b) => (String(a[key]).localeCompare(String(b[key]), undefined, { numeric: true }) * (sortDir === "desc" ? -1 : 1)) || a.id - b.id);
        return { items: rows.slice(offset, offset + limit), total: rows.length };
    });
}

const desktopVins = (container) => Array.from(container.querySelectorAll("tbody tr")).map((tr) => within(tr).getByText(/^TESTVIN/).textContent);
const chooseSize = (value) => fireEvent.change(screen.getByLabelText("Rows per page"), { target: { value } });
const loadEverything = async (timeout = 5000) => {
    // First the switch to All itself: its count reads "Showing 20 of …", not "Showing 1–25 of …".
    await screen.findByText(/^Showing (all )?\d+ of \d+ /, {}, { timeout });
    while (screen.queryByRole("button", { name: "Load more" })) {
        fireEvent.click(screen.getByRole("button", { name: "Load more" }));
        await waitFor(() => expect(screen.queryByText("Loading more…")).not.toBeInTheDocument(), { timeout });
    }
};

beforeEach(() => {
    CHUNK.size = 20;
    listOperationsBatchVehicles.mockReset();
    window.localStorage.clear();
});
afterEach(() => {
    delete window.IntersectionObserver;
});

describe("VehicleTable — All", () => {
    it("offers 10, 25, 50, 100 and All, starting at 25", async () => {
        serve(Array.from({ length: 60 }, (_, i) => vehicle(i + 1)));
        render(<VehicleTable batchId={1} refreshKey={0} />);
        const select = await screen.findByLabelText("Rows per page");
        expect(Array.from(select.options).map((o) => o.textContent)).toEqual(["10", "25", "50", "100", "All"]);
        expect(select.value).toBe("25");
        expect(screen.getByText(/Showing 1–25 of 60 vehicles/)).toBeInTheDocument();
    });

    it("shows all 437 vehicles of a batch, in the server's order, loading at most 200 at a time", { timeout: 120000 }, async () => {
        CHUNK.size = 200;
        expect(ALL_CHUNK_SIZE).toBe(200);
        // Rows are what this checks: showing only the VIN keeps 437 rows quick to draw.
        window.localStorage.setItem("operations:vehicles:columns", JSON.stringify(Object.fromEntries(
            ["year", "make", "model", "engine_value", "transmission_value", "src_our_database", "src_catdb_vin", "src_catdb_local",
                "src_ecotrade_local", "scrap_value", "total_expected_recovery", "known_components_subtotal", "overall_status",
                "completeness", "parts_status", "weight", "warnings"].map((id) => [id, false]),
        )));
        const vehicles = Array.from({ length: 437 }, (_, i) => vehicle(i + 1));
        serve(vehicles);
        const { container } = render(<VehicleTable batchId={1} refreshKey={0} />);
        await screen.findByLabelText("Rows per page");
        chooseSize("all");
        await screen.findByText("Showing 200 of 437 vehicles", {}, { timeout: 30000 });
        expect(screen.queryByLabelText("Next page")).not.toBeInTheDocument();
        await loadEverything(30000);
        expect(screen.getByText("Showing all 437 of 437 vehicles")).toBeInTheDocument();
        expect(desktopVins(container)).toEqual(vehicles.map((v) => v.full_vin));
        const calls = listOperationsBatchVehicles.mock.calls.map(([, args]) => args);
        // 200 is the most the vehicles endpoint returns (MAX_LIST_LIMIT).
        expect(Math.max(...calls.map((c) => c.limit))).toBeLessThanOrEqual(200);
        const allCalls = calls.filter((c) => c.limit === 200);
        expect(allCalls.map((c) => c.offset)).toEqual([0, 200, 400]);
    });

    it("keeps the status filter, the search and the sort in every chunk", async () => {
        serve(Array.from({ length: 437 }, (_, i) => vehicle(i + 1)));
        const { container } = render(<VehicleTable batchId={1} refreshKey={0} />);
        await screen.findByLabelText("Rows per page");
        fireEvent.click(screen.getByRole("button", { name: "Failed" }));
        fireEvent.change(screen.getByPlaceholderText(/Search VIN/), { target: { value: "ford" } });
        fireEvent.click(screen.getByText("Year"));
        await waitFor(() => expect(listOperationsBatchVehicles.mock.calls.at(-1)[1]).toMatchObject({ search: "ford", status: "FAILED", sortBy: "year" }));
        chooseSize("all");
        await loadEverything();
        // 87 FAILED vehicles, 29 of them Fords.
        expect(await screen.findByText("Showing all 29 of 29 vehicles")).toBeInTheDocument();
        const years = Array.from(container.querySelectorAll("tbody tr")).map((tr) => Number(tr.children[2].textContent));
        expect(years).toEqual([...years].sort((a, b) => a - b));
        // Two chunks of 20 for 29 rows, both with the same conditions.
        const chunks = listOperationsBatchVehicles.mock.calls.map(([, args]) => args).filter((a) => a.limit === 20);
        expect(chunks.map((a) => a.offset)).toEqual([0, 20]);
        for (const args of chunks) {
            expect(args).toMatchObject({ search: "ford", status: "FAILED", sortBy: "year", sortDir: "asc" });
        }
    });

    it("a search that matches 37 shows those 37", async () => {
        const vehicles = Array.from({ length: 90 }, (_, i) => vehicle(i + 1));
        vehicles.slice(0, 37).forEach((v) => { v.model = "Odyssey"; });
        serve(vehicles);
        render(<VehicleTable batchId={1} refreshKey={0} />);
        await screen.findByLabelText("Rows per page");
        chooseSize("all");
        fireEvent.change(screen.getByPlaceholderText(/Search VIN/), { target: { value: "odyssey" } });
        await screen.findByText("Showing 20 of 37 vehicles");
        await loadEverything();
        expect(screen.getByText("Showing all 37 of 37 vehicles")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
    });

    it("loads the next chunk by itself when the end scrolls into view", async () => {
        const observers = [];
        window.IntersectionObserver = class {
            constructor(callback) { this.callback = callback; observers.push(this); }
            observe() {}
            disconnect() { this.disconnected = true; }
        };
        serve(Array.from({ length: 45 }, (_, i) => vehicle(i + 1)));
        render(<VehicleTable batchId={1} refreshKey={0} />);
        await screen.findByLabelText("Rows per page");
        chooseSize("all");
        await screen.findByText("Showing 20 of 45 vehicles");
        act(() => observers.filter((o) => !o.disconnected).at(-1).callback([{ isIntersecting: true }]));
        expect(await screen.findByText("Showing 40 of 45 vehicles")).toBeInTheDocument();
    });

    it("going back to 25 brings back the pages, from page 1", async () => {
        serve(Array.from({ length: 120 }, (_, i) => vehicle(i + 1)));
        render(<VehicleTable batchId={1} refreshKey={0} />);
        await screen.findByLabelText("Rows per page");
        fireEvent.click(screen.getByLabelText("Next page"));
        await screen.findByText(/Showing 26–50 of 120/);
        chooseSize("all");
        await screen.findByText("Showing 20 of 120 vehicles");
        chooseSize("25");
        expect(await screen.findByText(/Showing 1–25 of 120 vehicles/)).toBeInTheDocument();
        expect(screen.getByLabelText("Next page")).toBeEnabled();
        chooseSize("50");
        expect(await screen.findByText(/Showing 1–50 of 120 vehicles/)).toBeInTheDocument();
    });

    it("remembers All after leaving for a vehicle and coming back", async () => {
        serve(Array.from({ length: 30 }, (_, i) => vehicle(i + 1)));
        const first = render(<VehicleTable batchId={1} refreshKey={0} />);
        await screen.findByLabelText("Rows per page");
        chooseSize("all");
        await screen.findByText("Showing 20 of 30 vehicles");
        first.unmount();
        render(<VehicleTable batchId={1} refreshKey={0} />);
        expect(await screen.findByText("Showing 20 of 30 vehicles")).toBeInTheDocument();
        expect(screen.getByLabelText("Rows per page").value).toBe("all");
    });

    it("selected vehicles stay selected while more load, and bulk selection still works", async () => {
        serve(Array.from({ length: 50 }, (_, i) => vehicle(i + 1)));
        const onSelectedIdsChange = vi.fn();
        const { rerender } = render(<VehicleTable batchId={1} refreshKey={0} selectedIds={[]} onSelectedIdsChange={onSelectedIdsChange} />);
        await screen.findByLabelText("Rows per page");
        chooseSize("all");
        await screen.findByText("Showing 20 of 50 vehicles");
        fireEvent.click(screen.getAllByLabelText("Select vehicle lot 1003")[0]);
        expect(onSelectedIdsChange).toHaveBeenLastCalledWith([3]);
        rerender(<VehicleTable batchId={1} refreshKey={0} selectedIds={[3]} onSelectedIdsChange={onSelectedIdsChange} />);
        await loadEverything();
        expect(screen.getAllByLabelText("Select vehicle lot 1003")[0]).toBeChecked();
        fireEvent.click(screen.getAllByLabelText("Select vehicle lot 1045")[0]);
        expect(onSelectedIdsChange).toHaveBeenLastCalledWith([3, 45]);
        expect(screen.getByText(/1 selected/)).toBeInTheDocument();
    });

    it("a refresh keeps every loaded row instead of starting over", async () => {
        serve(Array.from({ length: 50 }, (_, i) => vehicle(i + 1)));
        const { container, rerender } = render(<VehicleTable batchId={1} refreshKey={0} />);
        await screen.findByLabelText("Rows per page");
        chooseSize("all");
        await loadEverything();
        rerender(<VehicleTable batchId={1} refreshKey={1} />);
        await waitFor(() => expect(listOperationsBatchVehicles.mock.calls.at(-1)[1].offset).toBe(40));
        await waitFor(() => expect(container.querySelectorAll("tbody tr")).toHaveLength(50));
    });

    it("the phone layout lists every loaded vehicle too", async () => {
        serve(Array.from({ length: 53 }, (_, i) => vehicle(i + 1)));
        const { container } = render(<VehicleTable batchId={1} refreshKey={0} />);
        await screen.findByLabelText("Rows per page");
        chooseSize("all");
        await loadEverything();
        expect(container.querySelectorAll(".lg\\:hidden > div")).toHaveLength(53);
    });

    it("an empty batch says so, with or without All", async () => {
        serve([]);
        window.localStorage.setItem("operations:vehicles:page-size", "all");
        render(<VehicleTable batchId={1} refreshKey={0} />);
        expect(await screen.findByText("This batch has no vehicles.")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
    });

    it("a refused request shows its reason, and a failed next chunk keeps the rows already shown", async () => {
        const { CatalyticApiError } = await import("@/lib/catalytic/http");
        listOperationsBatchVehicles.mockRejectedValueOnce(new CatalyticApiError("You don't have access to Operations.", { status: 403 }));
        render(<VehicleTable batchId={1} refreshKey={0} />);
        expect(await screen.findByText("You don't have access to Operations.")).toBeInTheDocument();

        listOperationsBatchVehicles.mockReset();
        serve(Array.from({ length: 30 }, (_, i) => vehicle(i + 1)));
        window.localStorage.setItem("operations:vehicles:page-size", "all");
        const { container } = render(<VehicleTable batchId={2} refreshKey={0} />);
        await screen.findAllByText("Showing 20 of 30 vehicles");
        listOperationsBatchVehicles.mockRejectedValueOnce(new Error("network"));
        fireEvent.click(screen.getAllByRole("button", { name: "Load more" }).at(-1));
        expect(await screen.findByText("Couldn't load more rows.")).toBeInTheDocument();
        expect(container.querySelectorAll("tbody tr").length).toBe(20);
        fireEvent.click(screen.getByRole("button", { name: "Try again" }));
        expect(await screen.findByText("Showing all 30 of 30 vehicles")).toBeInTheDocument();
    });
});