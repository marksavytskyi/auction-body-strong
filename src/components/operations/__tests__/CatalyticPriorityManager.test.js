import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import CatalyticPriorityManager from "../CatalyticPriorityManager";

const ORDER = [
    { source: "OUR_DATABASE", enabled: true },
    { source: "CATDB_VIN", enabled: true },
    { source: "CATDB_LOCAL", enabled: true },
    { source: "ECOTRADE_LOCAL", enabled: true },
];
const sources = (list) => list.map((entry) => entry.source);

function setup(value = ORDER) {
    const onChange = vi.fn();
    render(<CatalyticPriorityManager value={value} onChange={onChange} />);
    return onChange;
}

describe("CatalyticPriorityManager", () => {
    it("numbers each source in order", () => {
        setup();
        const items = screen.getAllByRole("listitem");
        expect(items).toHaveLength(4);
        expect(items[0]).toHaveTextContent("1");
        expect(items[0]).toHaveTextContent("Our Database");
        expect(items[3]).toHaveTextContent("EcoTrade Local");
    });

    it("moves with the Up and Down buttons, and the ends can't go further", () => {
        const onChange = setup();
        expect(screen.getByRole("button", { name: "Move Our Database up" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Move EcoTrade Local down" })).toBeDisabled();
        fireEvent.click(screen.getByRole("button", { name: "Move Our Database down" }));
        expect(sources(onChange.mock.calls[0][0])).toEqual(["CATDB_VIN", "OUR_DATABASE", "CATDB_LOCAL", "ECOTRADE_LOCAL"]);
        expect(screen.getByRole("status")).toHaveTextContent("Our Database moved to position 2");
    });

    it("reorders from the keyboard on the handle", () => {
        const onChange = setup();
        fireEvent.keyDown(screen.getByRole("button", { name: /Reorder CatDB VIN Search/ }), { key: "ArrowUp" });
        expect(sources(onChange.mock.calls[0][0])).toEqual(["CATDB_VIN", "OUR_DATABASE", "CATDB_LOCAL", "ECOTRADE_LOCAL"]);
    });

    it("reorders by drag and drop", () => {
        const onChange = setup();
        fireEvent.dragStart(screen.getByTestId("priority-ECOTRADE_LOCAL"));
        const over = createEvent.dragOver(screen.getByTestId("priority-OUR_DATABASE"));
        fireEvent(screen.getByTestId("priority-OUR_DATABASE"), over);
        expect(sources(onChange.mock.calls[0][0])).toEqual(["ECOTRADE_LOCAL", "OUR_DATABASE", "CATDB_VIN", "CATDB_LOCAL"]);
    });

    it("turns a source off without moving it", () => {
        const onChange = setup();
        fireEvent.click(screen.getByRole("checkbox", { name: "CatDB Local" }));
        expect(onChange.mock.calls[0][0][2]).toEqual({ source: "CATDB_LOCAL", enabled: false });
    });

    it("warns when every source is off", () => {
        setup(ORDER.map((entry) => ({ ...entry, enabled: false })));
        expect(screen.getByRole("alert")).toHaveTextContent("Enable at least one source");
    });
});
