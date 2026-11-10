import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import VehicleTable from "../VehicleTable";
import { listOperationsBatchVehicles } from "@/lib/operations/api";

vi.mock("@/lib/operations/api", () => ({ listOperationsBatchVehicles: vi.fn() }));

// Phase K.49 — four catalytic columns, each showing only its own source, and a
// Columns menu whose choice is remembered.

const local = (source, overrides = {}) => ({
    source, status: "COMPLETED", match_type: "YEAR_MAKE_MODEL", confidence: "LOW",
    price_low: "40.0000", price_expected: "80.0000", price_high: "100.0000", searched_at: "2026-11-09T17:10:46",
    position_count: 2, candidate_count: 2, converter_codes: ["E1", "E2"], price_warning: null, ...overrides,
});

function vehicle(id, overrides = {}) {
    return {
        id, lot_number: String(1000 + id), full_vin: `TESTVIN${String(id).padStart(10, "0")}`, year: "2018", make: "HONDA", model: "CIVIC",
        overall_status: "PARTIAL", parts_status: "DONE", ourdb_status: "NOT_REQUESTED", catdb_status: "NOT_REQUESTED",
        catdb_total_price: null, catdb_price_min: null, catdb_price_max: null, ourdb_total_expected: null, catalytic_local: [],
        financials: { engine_value: 500, transmission_value: 300, cats_value: null, scrap_value: 70, known_components_subtotal: 870, total_expected_recovery: null, completeness_status: "PARTIAL" },
        ...overrides,
    };
}

const cell = (container, row, source) => container.querySelectorAll("tbody tr")[row].querySelector(`[data-source="${source}"]`);
const headers = () => screen.getAllByRole("columnheader").map((th) => th.textContent.trim());
const openColumns = () => {
    fireEvent.click(screen.getByRole("button", { name: /^Columns \(/ }));
    return screen.getByRole("dialog", { name: "Visible columns" });
};

beforeEach(() => {
    window.localStorage.clear();
    listOperationsBatchVehicles.mockReset();
});

describe("catalytic source columns", () => {
    it("has four separately named source columns instead of the old three", async () => {
        listOperationsBatchVehicles.mockResolvedValue({ items: [vehicle(1)], total: 1 });
        render(<VehicleTable batchId={1} refreshKey={0} />);
        await screen.findByRole("columnheader", { name: "EcoTrade Local" });
        const shown = headers();
        expect(shown).toEqual(expect.arrayContaining(["Our Database", "CatDB VIN", "CatDB Local", "EcoTrade Local"]));
        expect(shown).not.toContain("Catalytic");
        expect(shown).not.toContain("CatDB VIN Price");
        expect(shown).not.toContain("Our Database Price");
        expect(shown.indexOf("Transmission")).toBeLessThan(shown.indexOf("Our Database"));
        expect(shown.indexOf("EcoTrade Local")).toBeLessThan(shown.indexOf("Scrap"));
    });

    it("puts each price under the source that returned it, and only there", async () => {
        listOperationsBatchVehicles.mockResolvedValue({
            items: [vehicle(1, {
                ourdb_status: "DONE", ourdb_total_expected: "452.00", ourdb_is_estimate: true,
                catdb_status: "DONE", catdb_price_min: "300.00", catdb_price_max: "500.00", catdb_catalyst_quantity: 2,
                catalytic_local: [local("CATDB_LOCAL", { price_expected: "120.0000", converter_codes: ["C1"], position_count: 1, candidate_count: 1 }), local("ECOTRADE_LOCAL")],
            })],
            total: 1,
        });
        const { container } = render(<VehicleTable batchId={1} refreshKey={0} />);
        await screen.findByRole("columnheader", { name: "EcoTrade Local" });
        expect(cell(container, 0, "OUR_DATABASE")).toHaveTextContent("$452.00Estimate");
        expect(cell(container, 0, "CATDB_VIN")).toHaveTextContent("$300.00–$500.00 (2)");
        expect(cell(container, 0, "CATDB_LOCAL")).toHaveTextContent("$120.00");
        expect(cell(container, 0, "ECOTRADE_LOCAL")).toHaveTextContent("$80.00");
    });

    it("never fills one source's column from another source", async () => {
        listOperationsBatchVehicles.mockResolvedValue({
            items: [vehicle(1, { catalytic_local: [local("CATDB_LOCAL", { price_expected: "120.0000" })] })],
            total: 1,
        });
        const { container } = render(<VehicleTable batchId={1} refreshKey={0} />);
        await screen.findByRole("columnheader", { name: "EcoTrade Local" });
        expect(cell(container, 0, "CATDB_LOCAL")).toHaveTextContent("$120.00");
        expect(cell(container, 0, "CATDB_VIN")).toHaveTextContent("—");
        expect(cell(container, 0, "ECOTRADE_LOCAL")).toHaveTextContent("—");
        expect(cell(container, 0, "OUR_DATABASE")).toHaveTextContent("—");
    });

    it("shows no match, looking up, failed and not looked up as such, never as a price", async () => {
        listOperationsBatchVehicles.mockResolvedValue({
            items: [
                vehicle(1, { ourdb_status: "DONE", catdb_status: "NO_RESULT", catalytic_local: [local("CATDB_LOCAL", { status: "NO_MATCH", price_expected: null }), local("ECOTRADE_LOCAL", { status: "FAILED", price_expected: null })] }),
                vehicle(2, { ourdb_status: "QUEUED", catdb_status: "PROCESSING" }),
                vehicle(3, { ourdb_status: "FAILED", catdb_status: "SKIPPED_INELIGIBLE" }),
            ],
            total: 3,
        });
        const { container } = render(<VehicleTable batchId={1} refreshKey={0} />);
        await screen.findByRole("columnheader", { name: "EcoTrade Local" });
        expect(cell(container, 0, "OUR_DATABASE")).toHaveTextContent("No match");
        expect(cell(container, 0, "CATDB_VIN")).toHaveTextContent("No match");
        expect(cell(container, 0, "CATDB_LOCAL")).toHaveTextContent("No match");
        expect(cell(container, 0, "ECOTRADE_LOCAL")).toHaveTextContent("Failed");
        // K.53: queued without a running lease is Queued; a device working on it is Running.
        expect(cell(container, 1, "OUR_DATABASE")).toHaveTextContent("Queued");
        expect(cell(container, 1, "CATDB_VIN")).toHaveTextContent("Running");
        expect(cell(container, 2, "OUR_DATABASE")).toHaveTextContent("Failed");
        expect(cell(container, 2, "CATDB_VIN")).toHaveTextContent("Not eligible");
        expect(cell(container, 1, "CATDB_LOCAL")).toHaveTextContent("—");
    });

    it("details come from what was saved: match, confidence, converters, codes, lookup time", async () => {
        listOperationsBatchVehicles.mockResolvedValue({ items: [vehicle(1, { catalytic_local: [local("ECOTRADE_LOCAL")] })], total: 1 });
        const { container } = render(<VehicleTable batchId={1} refreshKey={0} />);
        await screen.findByRole("columnheader", { name: "EcoTrade Local" });
        const details = cell(container, 0, "ECOTRADE_LOCAL").getAttribute("title");
        expect(details).toContain("Source: EcoTrade Local");
        expect(details).toContain("Match: Year, make and model");
        expect(details).toContain("Confidence: LOW");
        expect(details).toContain("Range: $40.00–$100.00");
        expect(details).toContain("Positions: 2");
        expect(details).toContain("Converter candidates: 2");
        expect(details).toContain("Codes: E1, E2");
        expect(details).toContain("Last lookup:");
        // The total is shown once, not once per converter.
        expect(cell(container, 0, "ECOTRADE_LOCAL")).toHaveTextContent(/^\$80\.00Low confidence$/);
    });

    it("the phone layout lists the same sources", async () => {
        listOperationsBatchVehicles.mockResolvedValue({ items: [vehicle(1, { catalytic_local: [local("ECOTRADE_LOCAL")] })], total: 1 });
        const { container } = render(<VehicleTable batchId={1} refreshKey={0} />);
        await screen.findByRole("columnheader", { name: "EcoTrade Local" });
        const card = container.querySelector(".lg\\:hidden");
        for (const label of ["Our Database", "CatDB VIN", "CatDB Local", "EcoTrade Local"]) {
            expect(within(card).getByText(label)).toBeInTheDocument();
        }
        expect(card.querySelector('[data-source="ECOTRADE_LOCAL"]')).toHaveTextContent("$80.00");
    });
});

describe("Columns", () => {
    it("hides and shows a column, and remembers it after leaving the page", async () => {
        listOperationsBatchVehicles.mockResolvedValue({ items: [vehicle(1)], total: 1 });
        const first = render(<VehicleTable batchId={1} refreshKey={0} />);
        await screen.findByRole("columnheader", { name: "CatDB VIN" });
        const menu = openColumns();
        fireEvent.click(within(menu).getByRole("menuitemcheckbox", { name: "CatDB VIN" }));
        fireEvent.click(within(menu).getByRole("menuitemcheckbox", { name: "Scrap" }));
        expect(screen.queryByRole("columnheader", { name: "CatDB VIN" })).toBeNull();
        expect(screen.queryByRole("columnheader", { name: "Scrap" })).toBeNull();
        first.unmount();
        render(<VehicleTable batchId={1} refreshKey={0} />);
        await screen.findByRole("columnheader", { name: "Our Database" });
        expect(screen.queryByRole("columnheader", { name: "CatDB VIN" })).toBeNull();
        expect(screen.queryByRole("columnheader", { name: "Scrap" })).toBeNull();
    });

    it("Show All, Hide All and Reset to Default", async () => {
        listOperationsBatchVehicles.mockResolvedValue({ items: [vehicle(1)], total: 1 });
        render(<VehicleTable batchId={1} refreshKey={0} />);
        await screen.findByRole("columnheader", { name: "CatDB VIN" });
        const defaults = headers();
        expect(defaults).not.toContain("Catalytic (in totals)");
        let menu = openColumns();
        fireEvent.click(within(menu).getByRole("button", { name: "Show All" }));
        expect(headers()).toContain("Catalytic (in totals)");
        expect(headers()).toContain("OurDB status");
        fireEvent.click(within(menu).getByRole("button", { name: "Hide All" }));
        expect(headers()).toEqual(["Lot #"]);
        expect(within(menu).getByRole("menuitemcheckbox", { name: "Lot # (always shown)" })).toBeDisabled();
        fireEvent.click(within(menu).getByRole("button", { name: "Reset to Default" }));
        expect(headers()).toEqual(defaults);
        expect(JSON.parse(window.localStorage.getItem("operations:vehicles:columns"))).toEqual({});
    });

    it("every column the user asked for can be chosen", async () => {
        listOperationsBatchVehicles.mockResolvedValue({ items: [vehicle(1)], total: 1 });
        render(<VehicleTable batchId={1} refreshKey={0} />);
        await screen.findByRole("columnheader", { name: "CatDB VIN" });
        const names = within(openColumns()).getAllByRole("menuitemcheckbox").map((b) => b.textContent);
        for (const name of ["Make", "Model", "Year", "VIN", "Engine", "Transmission", "Scrap", "Our Database", "CatDB VIN", "CatDB Local", "EcoTrade Local", "Complete Recovery", "Status"]) {
            expect(names).toContain(name);
        }
    });

    it("hiding a column keeps search, sorting and the data as they were", async () => {
        listOperationsBatchVehicles.mockResolvedValue({ items: [vehicle(1)], total: 1 });
        render(<VehicleTable batchId={1} refreshKey={0} />);
        await screen.findByRole("columnheader", { name: "Year" });
        fireEvent.click(within(openColumns()).getByRole("menuitemcheckbox", { name: "VIN" }));
        const calls = listOperationsBatchVehicles.mock.calls.length;
        fireEvent.click(screen.getByRole("columnheader", { name: "Year" }));
        await waitFor(() => expect(listOperationsBatchVehicles.mock.calls.at(-1)[1]).toMatchObject({ sortBy: "year", sortDir: "asc" }));
        fireEvent.change(screen.getByPlaceholderText(/Search VIN/), { target: { value: "civic" } });
        await waitFor(() => expect(listOperationsBatchVehicles.mock.calls.at(-1)[1]).toMatchObject({ search: "civic", sortBy: "year" }));
        expect(listOperationsBatchVehicles.mock.calls.length).toBeGreaterThan(calls);
        expect(screen.getByLabelText("Rows per page")).toBeInTheDocument();
    });

    describe("K.53 live states", () => {
        const soon = () => new Date(Date.now() + 60_000).toISOString().replace("Z", "");
        const row = (container, i) => container.querySelectorAll("tbody tr")[i];
        const spinners = (el) => el.querySelectorAll("svg.animate-spin").length;

        it("a spinner only for work really running", async () => {
            listOperationsBatchVehicles.mockResolvedValue({
                items: [
                    vehicle(1, { ourdb_status: "QUEUED", ourdb_lease_expires_at: soon(), catdb_status: "QUEUED" }),
                    vehicle(2, { ourdb_status: "QUEUED", ourdb_lease_expires_at: null, catdb_status: "PROCESSING" }),
                ],
                total: 2,
            });
            const { container } = render(<VehicleTable batchId={1} refreshKey={0} />);
            await screen.findByRole("columnheader", { name: "EcoTrade Local" });
            expect(cell(container, 0, "OUR_DATABASE")).toHaveTextContent("Running");
            expect(spinners(cell(container, 0, "OUR_DATABASE"))).toBe(1);
            expect(cell(container, 0, "CATDB_VIN")).toHaveTextContent("Queued");
            expect(spinners(cell(container, 0, "CATDB_VIN"))).toBe(0);
            expect(spinners(cell(container, 1, "OUR_DATABASE"))).toBe(0);
            expect(spinners(cell(container, 1, "CATDB_VIN"))).toBe(1);
        });

        it("a job whose device stopped reporting is never shown as running (production smoke test, job 323)", async () => {
            listOperationsBatchVehicles.mockResolvedValue({
                items: [
                    vehicle(1, { catdb_status: "PROCESSING", catdb_job_id: 323, catdb_queue_state: "STALE" }),
                    vehicle(2, { catdb_status: "QUEUED", catdb_job_id: 324, catdb_queue_state: "PAUSED" }),
                    vehicle(3, { catdb_status: "PROCESSING", catdb_job_id: 325, catdb_queue_state: "RUNNING" }),
                ],
                total: 3,
            });
            const { container } = render(<VehicleTable batchId={1} refreshKey={0} />);
            await screen.findByRole("columnheader", { name: "EcoTrade Local" });
            expect(cell(container, 0, "CATDB_VIN")).toHaveTextContent("Device stopped");
            expect(spinners(cell(container, 0, "CATDB_VIN"))).toBe(0);
            expect(cell(container, 0, "CATDB_VIN").querySelector("[title]").getAttribute("title")).toMatch(/stopped reporting.*no search was recorded/);
            expect(cell(container, 1, "CATDB_VIN")).toHaveTextContent("Paused");
            expect(spinners(cell(container, 1, "CATDB_VIN"))).toBe(0);
            expect(spinners(cell(container, 2, "CATDB_VIN"))).toBe(1); // a live lease really is running
        });

        it("a paid timeout is Requires review, explained, never No match", async () => {
            listOperationsBatchVehicles.mockResolvedValue({ items: [vehicle(1, { catdb_status: "REVIEW_REQUIRED", catdb_job_id: 324 })], total: 1 });
            const { container } = render(<VehicleTable batchId={1} refreshKey={0} />);
            await screen.findByRole("columnheader", { name: "EcoTrade Local" });
            const vin = cell(container, 0, "CATDB_VIN");
            expect(vin).toHaveTextContent("Review");
            expect(vin).not.toHaveTextContent("No match");
            expect(vin.querySelector("[title]").getAttribute("title")).toMatch(/outcome is unknown.*never searched again automatically.*CatDB job #324/);
        });

        it("a stored price stays when the latest attempt fails, with the failure shown under it", async () => {
            listOperationsBatchVehicles.mockResolvedValue({
                items: [vehicle(1, { ourdb_total_expected: 320, ourdb_status: "FAILED", catdb_status: "QUEUED", catdb_price_min: 200, catdb_price_max: 300 })],
                total: 1,
            });
            const { container } = render(<VehicleTable batchId={1} refreshKey={0} />);
            await screen.findByRole("columnheader", { name: "EcoTrade Local" });
            expect(cell(container, 0, "OUR_DATABASE")).toHaveTextContent("$320.00");
            expect(cell(container, 0, "OUR_DATABASE")).toHaveTextContent("Failed");
            expect(cell(container, 0, "CATDB_VIN")).toHaveTextContent("$200");
            expect(cell(container, 0, "CATDB_VIN")).toHaveTextContent("Queued");
        });

        it("Engine, Transmission and Scrap say what Parts and Weight are doing", async () => {
            const noPrices = { engine_value: null, transmission_value: null, cats_value: null, scrap_value: null, known_components_subtotal: null, total_expected_recovery: null, completeness_status: "NO_DATA" };
            listOperationsBatchVehicles.mockResolvedValue({
                items: [
                    vehicle(1, { parts_status: "PROCESSING", scrap_status: "QUEUED", financials: noPrices }),
                    vehicle(2, { parts_status: "DONE", scrap_status: "NO_DATA", financials: noPrices }),
                    vehicle(3, { parts_status: "FAILED", scrap_status: "NOT_REQUESTED", financials: noPrices }),
                ],
                total: 3,
            });
            const { container } = render(<VehicleTable batchId={1} refreshKey={0} />);
            await screen.findByRole("columnheader", { name: "EcoTrade Local" });
            const states = (i) => [...row(container, i).querySelectorAll("[data-state]")].map((el) => el.getAttribute("data-state"));
            expect(states(0)).toEqual(expect.arrayContaining(["RUNNING", "QUEUED"]));
            expect(states(1)).toEqual(expect.arrayContaining(["NO_MATCH", "NO_DATA"]));
            expect(states(2)).toEqual(expect.arrayContaining(["FAILED", "NOT_REQUESTED"]));
            expect(row(container, 1)).not.toHaveTextContent("$");
        });
    });
});

