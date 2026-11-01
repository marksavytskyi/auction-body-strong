import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ScrapPriceControl from "../ScrapPriceControl";
import { getScrapPrice, setScrapPrice } from "@/lib/operations/api";
import { CatalyticApiError } from "@/lib/catalytic/http";

vi.mock("@/lib/operations/api", () => ({ getScrapPrice: vi.fn(), setScrapPrice: vi.fn() }));
vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const PRICE = { price: "0.0800", currency: "USD", weight_unit: "LB", version: 3, updated_at: "2026-11-01T10:00:00" };

async function openEditor(value) {
    render(<ScrapPriceControl onChanged={onChanged} />);
    fireEvent.click(await screen.findByRole("button", { name: "Change" }));
    if (value !== undefined) fireEvent.change(screen.getByLabelText(/new scrap price/i), { target: { value } });
}

const onChanged = vi.fn();

describe("ScrapPriceControl", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getScrapPrice.mockResolvedValue(PRICE);
    });

    it("shows the current price, currency, unit and last update", async () => {
        render(<ScrapPriceControl />);
        expect(await screen.findByText(/\$0\.0800/)).toBeInTheDocument();
        expect(screen.getByText(/USD per lb/)).toBeInTheDocument();
        expect(screen.getByText(/^Updated /)).toBeInTheDocument();
    });

    it("saves only after the exact confirmation, as a string with the version read", async () => {
        setScrapPrice.mockResolvedValue({ ...PRICE, price: "0.1200", version: 4 });
        await openEditor("0.12");
        fireEvent.click(screen.getByRole("button", { name: "Save" }));
        expect(setScrapPrice).not.toHaveBeenCalled();
        expect(screen.getByText("Updating the Scrap Price will recalculate Scrap values for all vehicles and batches.")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Update price" }));
        await waitFor(() => expect(setScrapPrice).toHaveBeenCalledWith({ price: "0.12", weightUnit: "LB", expectedVersion: 3 }));
        expect(await screen.findByText(/\$0\.1200/)).toBeInTheDocument();
        expect(onChanged).toHaveBeenCalledTimes(1);
    });

    it("a double tap on confirm sends one request", async () => {
        let finish;
        setScrapPrice.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
        await openEditor("0.12");
        fireEvent.click(screen.getByRole("button", { name: "Save" }));
        const confirm = screen.getByRole("button", { name: "Update price" });
        fireEvent.click(confirm);
        fireEvent.click(confirm);
        expect(setScrapPrice).toHaveBeenCalledTimes(1);
        finish({ ...PRICE, version: 4 });
        await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });

    it.each(["", "-1", "abc", "1e3", "0.12345"])("cannot save the invalid value %j", async (value) => {
        await openEditor(value);
        expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    });

    it("shows the server's error and keeps the price on failure", async () => {
        setScrapPrice.mockRejectedValue(new CatalyticApiError("Scrap price cannot exceed $10 per lb", { status: 400 }));
        await openEditor("9");
        fireEvent.click(screen.getByRole("button", { name: "Save" }));
        fireEvent.click(screen.getByRole("button", { name: "Update price" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("cannot exceed");
        expect(screen.getByText(/\$0\.0800/)).toBeInTheDocument();
        expect(onChanged).not.toHaveBeenCalled();
    });

    it("reloads the price when someone else changed it first", async () => {
        setScrapPrice.mockRejectedValue(new CatalyticApiError("changed by someone else", { status: 409 }));
        await openEditor("0.2");
        fireEvent.click(screen.getByRole("button", { name: "Save" }));
        fireEvent.click(screen.getByRole("button", { name: "Update price" }));
        await waitFor(() => expect(getScrapPrice).toHaveBeenCalledTimes(2));
    });
});
