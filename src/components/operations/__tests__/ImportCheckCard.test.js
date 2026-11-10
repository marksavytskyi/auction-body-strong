import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ImportCheckCard from "../ImportCheckCard";
import { getImport, listVehicles } from "@/lib/catalytic/copartImport";

vi.mock("@/lib/catalytic/copartImport", () => ({ getImport: vi.fn(), listVehicles: vi.fn() }));

// Phase K.51 — the removed Copart Imports page's row check, inside Operations Batch Details.
const SUMMARY = { id: 3, filename: "copart.csv", total_rows: 5, valid_rows: 4, invalid_rows: 1, duplicate_rows: 1, full_vin_rows: 2, masked_vin_rows: 1 };
const V = (id, extra) => ({ id, source_row_number: id + 1, lot_number: `L${id}`, source_vin: `VIN${id}`, row_valid: true, vin_state: "NOT_REQUIRED", ...extra });

beforeEach(() => {
    vi.clearAllMocks();
    getImport.mockResolvedValue(SUMMARY);
    listVehicles.mockResolvedValue([
        V(1), V(2, { row_valid: false, validation_error: "Missing year" }), V(3, { vin_state: "MASKED", source_vin: "1HGCM8263******" }),
        V(4, { vin_state: "INVALID" }), V(5),
    ]);
});

describe("ImportCheckCard", () => {
    it("summarizes the file closed, and loads rows only when opened", async () => {
        render(<ImportCheckCard copartImportId={3} />);
        expect(await screen.findByText(/4 of 5 rows valid · 1 invalid · 1 masked VINs/)).toBeInTheDocument();
        expect(listVehicles).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: /Import check/ }));
        const table = await screen.findByRole("table");
        expect(listVehicles).toHaveBeenCalledWith(3, { limit: 1000, offset: 0 });
        const rows = within(table).getAllByRole("row").slice(1).map((r) => r.textContent);
        expect(rows).toEqual([
            expect.stringContaining("Missing year"),
            expect.stringContaining("Masked VIN: not searchable in CatDB"),
            expect.stringContaining("Not a valid VIN: not searchable in CatDB"),
        ]);
    });

    it("says so when every row checked out", async () => {
        getImport.mockResolvedValue({ ...SUMMARY, valid_rows: 5, invalid_rows: 0, masked_vin_rows: 0 });
        listVehicles.mockResolvedValue([V(1), V(2)]);
        render(<ImportCheckCard copartImportId={3} />);
        fireEvent.click(await screen.findByRole("button", { name: /Import check/ }));
        expect(await screen.findByText("Every row checked out.")).toBeInTheDocument();
    });

    it("renders nothing without an import", () => {
        const { container } = render(<ImportCheckCard copartImportId={null} />);
        expect(container).toBeEmptyDOMElement();
        expect(getImport).not.toHaveBeenCalled();
    });
});
