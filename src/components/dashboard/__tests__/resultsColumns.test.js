import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ResultsSection from "@/app/dashboard/components/ResultsSection";

const headers = ["Lot URL", "engine_price_missing", "match_reason", "avg_engine_price_usd", "debug_json"];
const props = {
    jobId: "1", jobStatus: "done", jobRows: 1, jobCols: 5, headers,
    rows: [{ "Lot URL": "https://x", engine_price_missing: "false", match_reason: "ok", avg_engine_price_usd: "899.0", debug_json: '{"a":1}' }],
    totalRows: 1, query: "", setQuery: vi.fn(), page: 1, setPage: vi.fn(), pageSize: 25, setPageSize: vi.fn(),
    isProcessing: false, elapsedSec: 0, downloadResult: vi.fn(),
};

describe("Visible Columns", () => {
    beforeEach(() => window.localStorage.clear());

    const openMenu = () => {
        fireEvent.click(screen.getByRole("button", { name: /columns \(/i }));
        return screen.getByText("Visible Columns").parentElement.parentElement;
    };

    it("shows readable names and searches by them", () => {
        render(<ResultsSection {...props} openModal={vi.fn()} />);
        const menu = openMenu();
        expect(within(menu).getByText("Engine Price Missing")).toBeInTheDocument();
        expect(within(menu).queryByText("engine_price_missing")).not.toBeInTheDocument();

        fireEvent.change(within(menu).getByPlaceholderText(/search column/i), { target: { value: "engine price" } });
        expect(within(menu).getByText("Engine Price")).toBeInTheDocument();
        expect(within(menu).queryByText("Match Reason")).not.toBeInTheDocument();
    });

    it("still saves raw field names, so existing preferences keep working", () => {
        window.localStorage.setItem("dashboard:visible-columns", JSON.stringify(["match_reason", "debug_json"]));
        render(<ResultsSection {...props} openModal={vi.fn()} />);
        expect(screen.getByRole("button", { name: /columns \(2\/5\)/i })).toBeInTheDocument();

        const menu = openMenu();
        fireEvent.click(within(menu).getByText("Engine Price Missing"));
        const saved = JSON.parse(window.localStorage.getItem("dashboard:visible-columns"));
        expect(saved).toContain("engine_price_missing");
    });

    it("Select All and Deselect All still work", () => {
        render(<ResultsSection {...props} openModal={vi.fn()} />);
        const menu = openMenu();
        fireEvent.click(within(menu).getByRole("button", { name: /deselect all/i }));
        expect(screen.getByRole("button", { name: /columns \(1\/5\)/i })).toBeInTheDocument();
        fireEvent.click(within(menu).getByRole("button", { name: /select all/i }));
        expect(screen.getByRole("button", { name: /columns \(5\/5\)/i })).toBeInTheDocument();
    });

    it("View Details passes the right vehicle, in normal and fullscreen mode", () => {
        const openModal = vi.fn();
        render(<ResultsSection {...props} openModal={openModal} />);
        fireEvent.click(screen.getByRole("button", { name: /view details/i }));
        expect(openModal).toHaveBeenCalledWith({ a: 1 });

        fireEvent.click(screen.getByRole("button", { name: /^fullscreen$/i }));
        const buttons = screen.getAllByRole("button", { name: /view details/i });
        fireEvent.click(buttons.at(-1));
        expect(openModal).toHaveBeenCalledTimes(2);
    });
});
