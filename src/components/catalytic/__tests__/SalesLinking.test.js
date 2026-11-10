import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SalesLinking from "../SalesLinking";
import * as api from "@/lib/catalytic/salesImport";

vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/catalytic/salesImport", () => ({ listImportedSales: vi.fn(), getLinkSuggestions: vi.fn(), linkImportedSale: vi.fn() }));

// K.51 review — linked vs unlinked imported sales, against a mocked API.
const SALE = (id, code, linked) => ({
    sale_id: id, physical_code: code, converter_code: code, converter_id: id + 100, unit_price: 310, currency: "USD", quantity: 1,
    vehicle: "2019 Toyota RAV4", filename: "sales.csv", row_number: id + 1, linked, vehicle_positions: linked ? 1 : 0,
});
const COUNTS = { linked: 1, unlinked: 1, total: 2 };

beforeEach(() => {
    vi.clearAllMocks();
    api.listImportedSales.mockImplementation(async ({ link }) => {
        const all = [SALE(2, "ABC-12", false), SALE(1, "ABC123", true)];
        const items = link === "linked" ? all.filter((s) => s.linked) : link === "unlinked" ? all.filter((s) => !s.linked) : all;
        return { items, total: items.length, counts: COUNTS };
    });
    api.getLinkSuggestions.mockResolvedValue({ items: [{ converter_id: 101, code: "ABC123", vehicle_positions: 1 }] });
    api.linkImportedSale.mockResolvedValue(SALE(2, "ABC-12", true));
});

describe("Imported sales in Our Database", () => {
    it("shows the linked and unlinked counts and starts on the unlinked ones", async () => {
        render(<SalesLinking refreshKey={0} />);
        expect(await screen.findByText("1 linked")).toBeInTheDocument();
        expect(screen.getByText("1 unlinked")).toBeInTheDocument();
        expect(api.listImportedSales).toHaveBeenCalledWith(expect.objectContaining({ link: "unlinked" }));
        expect(await screen.findByText("ABC-12")).toBeInTheDocument();
        expect(screen.queryByText("ABC123")).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: /^Linked 1/ }));
        expect(await screen.findByText("Linked · 1 position")).toBeInTheDocument();
    });

    it("linking asks first, then points the sale at the chosen converter", async () => {
        render(<SalesLinking refreshKey={0} />);
        fireEvent.click(await screen.findByRole("button", { name: "Link…" }));
        const list = await screen.findByLabelText("Catalog converters");
        expect(api.linkImportedSale).not.toHaveBeenCalled();
        fireEvent.click(within(list).getByRole("button", { name: "Link to ABC123" }));
        const dialog = screen.getByRole("dialog", { name: "Link this sale to ABC123?" });
        expect(within(dialog).getByText(/No vehicle is linked to any converter/)).toBeInTheDocument();
        fireEvent.click(within(dialog).getByRole("button", { name: "Link sale" }));
        await waitFor(() => expect(api.linkImportedSale).toHaveBeenCalledWith(2, 101));
    });

    it("offers a verified observation instead of creating a vehicle link", async () => {
        render(<SalesLinking refreshKey={0} />);
        fireEvent.click(await screen.findByRole("button", { name: "Link…" }));
        expect(await screen.findByRole("link", { name: /Record observation for 2019 Toyota RAV4/ })).toHaveAttribute("href", "/cats/observations?record=1&code=ABC-12");
    });

    it("renders nothing before any sale was imported", async () => {
        api.listImportedSales.mockResolvedValue({ items: [], total: 0, counts: { linked: 0, unlinked: 0, total: 0 } });
        const { container } = render(<SalesLinking refreshKey={0} />);
        await waitFor(() => expect(api.listImportedSales).toHaveBeenCalled());
        await waitFor(() => expect(container).toBeEmptyDOMElement());
    });
});
