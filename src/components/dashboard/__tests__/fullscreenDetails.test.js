import React, { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DetailsModal from "@/app/dashboard/components/DetailsModal";
import TableFullscreenModal from "../TableFullscreenModal";
import { DebugTable } from "../DebugTable";

function Harness() {
    const [fullscreen, setFullscreen] = useState(false);
    const [details, setDetails] = useState(null);
    const rows = ["first", "second"].map((name) => (
        <button key={name} onClick={() => setDetails(name)}>View {name}</button>
    ));
    return (
        <div>
            <button onClick={() => setFullscreen(true)}>Enter fullscreen</button>
            {rows}
            <TableFullscreenModal isOpen={fullscreen} onClose={() => setFullscreen(false)} title="Results Table">
                {rows}
            </TableFullscreenModal>
            <DetailsModal isOpen={Boolean(details)} data={details} onClose={() => setDetails(null)}>
                <p>Details of {details}</p>
            </DetailsModal>
        </div>
    );
}

const zIndexOf = (element) => Number(element.style.zIndex);

describe("View Details over the fullscreen table", () => {
    it("opens above the table, and Escape closes only the top layer", () => {
        render(<Harness />);
        fireEvent.click(screen.getByText("Enter fullscreen"));
        const table = screen.getByText("Results Table").closest("[style]");

        fireEvent.click(screen.getAllByText("View first").at(-1));
        const dialog = screen.getByRole("dialog");
        expect(within(dialog).getByText("Details of first")).toBeInTheDocument();
        expect(dialog.parentElement).toBe(document.body);
        expect(zIndexOf(dialog)).toBeGreaterThan(zIndexOf(table));

        fireEvent.keyDown(document, { key: "Escape" });
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(screen.getByText("Results Table")).toBeInTheDocument();

        fireEvent.click(screen.getAllByText("View second").at(-1));
        expect(screen.getByText("Details of second")).toBeInTheDocument();
        fireEvent.keyDown(document, { key: "Escape" });

        fireEvent.keyDown(document, { key: "Escape" });
        expect(screen.queryByText("Results Table")).not.toBeInTheDocument();
        expect(document.body.style.overflow).toBe("");

        fireEvent.click(screen.getByText("View first"));
        expect(screen.getByText("Details of first")).toBeInTheDocument();
    });
});

describe("Source listings table", () => {
    const rows = [{ id: 0, model_norm: "500", year: 2014, disp: 1.8, mileage: 56455, price_usd: 899, description: "RUNS" }];

    it("uses currency only for the price", () => {
        render(<DebugTable data={rows} />);
        const cells = screen.getAllByRole("cell").map((cell) => cell.textContent);
        expect(cells).toEqual(["0", "500", "2014", "1.8", "56,455", "$899", "RUNS"]);
    });

    it("shows a placeholder instead of an empty, NaN or undefined value", () => {
        render(<DebugTable data={[{ id: 1, disp: null, mileage: undefined, price_usd: "" }, { id: 2, disp: 2, mileage: 5, price_usd: 1 }]} />);
        const text = screen.getAllByRole("cell").map((cell) => cell.textContent).join(" ");
        expect(text).toContain("—");
        expect(text).not.toMatch(/NaN|undefined|null/);
    });

    it("opens the column menu by tap, with readable names", () => {
        render(<DebugTable data={rows} />);
        const list = screen.getByText("Visibility").closest("div.absolute");
        expect(list).toHaveClass("hidden");
        fireEvent.click(screen.getByRole("button", { name: /columns/i }));
        expect(list).not.toHaveClass("hidden");
        expect(within(list).getByText("Engine (L)")).toBeInTheDocument();
    });
});
