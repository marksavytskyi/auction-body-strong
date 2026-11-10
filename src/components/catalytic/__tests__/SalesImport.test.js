import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SalesImport from "../SalesImport";
import * as api from "@/lib/catalytic/salesImport";

vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/catalytic/salesImport", () => ({
    uploadSalesFile: vi.fn(), listSalesImports: vi.fn(), getSalesImport: vi.fn(), setSalesImportStructure: vi.fn(),
    setSalesImportMapping: vi.fn(), suggestSalesImportMapping: vi.fn(), listSalesImportRows: vi.fn(), editSalesImportRow: vi.fn(),
    setSalesImportDecision: vi.fn(), listSalesImportTemplates: vi.fn(), saveSalesImportTemplate: vi.fn(),
    applySalesImportTemplate: vi.fn(), commitSalesImport: vi.fn(), discardSalesImport: vi.fn(),
}));

// Phase K.51 — the import screen, against a mocked API: nothing reaches the ledger
// until "Import Approved Sales" is confirmed, and AI is asked only on a click.

const COUNTS = { READY: 2, REQUIRES_REVIEW: 1, DUPLICATE: 1, NOT_A_SALE: 1, AMBIGUOUS: 0, MISSING_REQUIRED: 0, INVALID: 1 };
const IMPORT = {
    id: 4, filename: "sales.xlsx", status: "MAPPING", sheet_names: ["Sheet1"], sheet_name: "Sheet1", header_row: 0,
    headers: ["Car", "Cat #", "Sold for", "Qty", "Date"], total_rows: 6, counts: COUNTS, selected: 2,
    mapping: { Car: "vehicle_description", "Cat #": "converter_code", "Sold for": "unit_price", Qty: "quantity", Date: "sale_date" },
    options: { default_currency: "USD", date_order: "", all_rows_are_sales: true }, mapping_problems: [],
    fields: { vehicle_description: "Vehicle description", converter_code: "Converter code", unit_price: "Unit price", total_price: "Total price", quantity: "Quantity", sale_date: "Sale date" },
    template: null, already_imported_as: null,
};
const row = (id, status, extra = {}) => ({
    id, row_number: id + 1, status, decision: "AUTO", will_import: status === "READY", sale_id: null, edits: {},
    values: { converter_code: `C${id}`, unit_price: "120.00", currency: "USD", quantity: 1, sale_date: "2026-10-01", year: 2019, make: "Toyota", model: "RAV4" },
    raw: { Car: "2019 Toyota RAV4", "Cat #": `C${id}`, "Sold for": "$120" }, messages: status === "READY" ? [] : ["needs a look"], ...extra,
});
const ROWS = [row(1, "READY"), row(2, "READY"), row(3, "REQUIRES_REVIEW"), row(4, "DUPLICATE"), row(5, "NOT_A_SALE"), row(6, "INVALID")];

beforeEach(() => {
    vi.clearAllMocks();
    api.listSalesImports.mockResolvedValue([]);
    api.listSalesImportTemplates.mockResolvedValue([]);
    api.uploadSalesFile.mockResolvedValue(IMPORT);
    api.getSalesImport.mockResolvedValue(IMPORT);
    api.listSalesImportRows.mockImplementation(async (_id, { status, limit = 50, offset = 0 } = {}) => {
        const list = status === "PROBLEMS" ? ROWS.filter((r) => r.status !== "READY") : status ? ROWS.filter((r) => r.status === status) : ROWS;
        return { items: list.slice(offset, offset + limit), total: list.length };
    });
    api.setSalesImportDecision.mockResolvedValue({ ...IMPORT, selected: 3, changed: 1 });
    api.commitSalesImport.mockResolvedValue({ ...IMPORT, status: "COMMITTED", newly_imported: 2 });
});

async function uploaded() {
    render(<SalesImport />);
    const file = new File(["x"], "sales.xlsx");
    fireEvent.change(screen.getByLabelText("Sales file"), { target: { files: [file] } });
    await screen.findByLabelText("Column mapping");
    await screen.findByText("Row");
    return file;
}

describe("Smart Sales Import", () => {
    it("uploads, proposes a mapping and shows the counts", async () => {
        const file = await uploaded();
        expect(api.uploadSalesFile).toHaveBeenCalledWith(file);
        expect(screen.getByLabelText("Field for Cat #")).toHaveValue("converter_code");
        expect(screen.getByLabelText("Field for Sold for")).toHaveValue("unit_price");
        const tiles = Object.fromEntries(["Total rows", "Ready", "Duplicates", "Invalid", "Need review", "Not sales", "Selected"]
            .map((l) => [l, screen.getAllByText(l).find((el) => el.previousSibling)?.previousSibling.textContent]));
        expect(tiles).toEqual({ "Total rows": "6", Ready: "2", Duplicates: "1", Invalid: "1", "Need review": "1", "Not sales": "1", Selected: "2" });
        expect(api.suggestSalesImportMapping).not.toHaveBeenCalled();
        expect(api.commitSalesImport).not.toHaveBeenCalled();
    });

    it("a field can be used by one column only, and changes apply only when asked", async () => {
        await uploaded();
        const qty = screen.getByLabelText("Field for Qty");
        expect(within(qty).getByRole("option", { name: "Unit price" })).toBeDisabled();
        fireEvent.change(screen.getByLabelText("Field for Date"), { target: { value: "" } });
        expect(api.setSalesImportMapping).not.toHaveBeenCalled();
        api.setSalesImportMapping.mockResolvedValue({ ...IMPORT, mapping: { ...IMPORT.mapping, Date: "" } });
        fireEvent.click(screen.getByRole("button", { name: "Apply mapping" }));
        await waitFor(() => expect(api.setSalesImportMapping).toHaveBeenCalledWith(4, { mapping: { ...IMPORT.mapping, Date: "" }, options: IMPORT.options }));
    });

    it("AI only suggests: nothing changes until Use it", async () => {
        api.suggestSalesImportMapping.mockResolvedValue({ mapping: { ...IMPORT.mapping, Qty: "" }, rejected: [{ column: "Sold for", field: "total_price", reason: "another column already has this field" }], problems: [] });
        await uploaded();
        fireEvent.click(screen.getByRole("button", { name: /Suggest with AI/ }));
        expect(await screen.findByText("AI suggestion (not applied)")).toBeInTheDocument();
        expect(screen.getByText(/another column already has this field/)).toBeInTheDocument();
        expect(screen.getByLabelText("Field for Qty")).toHaveValue("quantity");
        fireEvent.click(screen.getByRole("button", { name: "Use it" }));
        expect(screen.getByLabelText("Field for Qty")).toHaveValue("");
        expect(api.setSalesImportMapping).not.toHaveBeenCalled();
    });

    it("problem rows can be listed, and blocked ones can't be ticked", async () => {
        await uploaded();
        fireEvent.click(screen.getByRole("button", { name: /^Problems 4/ }));
        await waitFor(() => expect(api.listSalesImportRows).toHaveBeenLastCalledWith(4, expect.objectContaining({ status: "PROBLEMS" })));
        expect(await screen.findByLabelText("Import row 7")).toBeDisabled();
        expect(screen.getByLabelText("Import row 6")).toBeDisabled();
        fireEvent.click(screen.getByLabelText("Import row 4"));
        await waitFor(() => expect(api.setSalesImportDecision).toHaveBeenCalledWith(4, { decision: "INCLUDE", rowIds: [3] }));
    });

    it("a row can be fixed in place", async () => {
        api.editSalesImportRow.mockResolvedValue(row(3, "READY"));
        await uploaded();
        const tableRow = (await screen.findByText("C3")).closest("tr");
        fireEvent.click(within(tableRow).getByRole("button", { name: "Edit" }));
        fireEvent.change(screen.getByLabelText("Unit price"), { target: { value: "150" } });
        fireEvent.click(screen.getByRole("button", { name: "Save row" }));
        await waitFor(() => expect(api.editSalesImportRow).toHaveBeenCalledWith(4, 3, expect.objectContaining({ unit_price: "150", converter_code: "C3" })));
    });

    it("Import Approved Sales asks first, then imports once", async () => {
        const onImported = vi.fn();
        render(<SalesImport onImported={onImported} />);
        fireEvent.change(screen.getByLabelText("Sales file"), { target: { files: [new File(["x"], "sales.xlsx")] } });
        fireEvent.click(await screen.findByRole("button", { name: "Import Approved Sales (2)" }));
        expect(api.commitSalesImport).not.toHaveBeenCalled();
        const dialog = screen.getByRole("dialog", { name: "Import 2 sales?" });
        expect(within(dialog).getByText(/4 rows stay out/)).toBeInTheDocument();
        fireEvent.click(within(dialog).getByRole("button", { name: "Import Approved Sales" }));
        await waitFor(() => expect(api.commitSalesImport).toHaveBeenCalledTimes(1));
        expect(await screen.findByRole("status")).toHaveTextContent("2 sales added");
        expect(onImported).toHaveBeenCalled();
    });

    it("can't import while the mapping has problems", async () => {
        api.uploadSalesFile.mockResolvedValue({ ...IMPORT, mapping_problems: ["Map a column to Converter code"] });
        await uploaded();
        expect(screen.getByRole("button", { name: /Import Approved Sales/ })).toBeDisabled();
        expect(screen.getByText("Map a column to Converter code")).toBeInTheDocument();
    });

    it("warns when this exact file was already imported", async () => {
        api.uploadSalesFile.mockResolvedValue({ ...IMPORT, already_imported_as: { id: 2 } });
        await uploaded();
        expect(screen.getByText(/This exact file was already imported \(import #2\)/)).toBeInTheDocument();
    });

    it("lists earlier imports", async () => {
        api.listSalesImports.mockResolvedValue([{ id: 2, filename: "oct.csv", status: "COMMITTED", total_rows: 10, imported_rows: 8 }]);
        render(<SalesImport />);
        expect(await screen.findByText(/#2 oct.csv · 8 of 10 imported/)).toBeInTheDocument();
    });
});
