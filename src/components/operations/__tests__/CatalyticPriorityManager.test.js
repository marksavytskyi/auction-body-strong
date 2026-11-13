import { fireEvent, render, screen } from "@testing-library/react";
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

    it("K.60: the order is fixed, nothing can be reordered", () => {
        setup();
        expect(screen.queryAllByRole("button")).toHaveLength(0);
        expect(screen.getByTestId("priority-ECOTRADE_LOCAL").getAttribute("draggable")).toBeNull();
    });

    it("K.60: a saved custom order (Batch 21/22) is shown in the fixed order with its switches", () => {
        const onChange = setup([
            { source: "OUR_DATABASE", enabled: true }, { source: "CATDB_LOCAL", enabled: true },
            { source: "ECOTRADE_LOCAL", enabled: true }, { source: "CATDB_VIN", enabled: false },
        ]);
        const items = screen.getAllByRole("listitem");
        expect(items.map((li) => li.getAttribute("data-testid"))).toEqual(
            ["priority-OUR_DATABASE", "priority-CATDB_VIN", "priority-CATDB_LOCAL", "priority-ECOTRADE_LOCAL"]);
        expect(screen.getByRole("checkbox", { name: "CatDB VIN Search" })).not.toBeChecked();
        fireEvent.click(screen.getByRole("checkbox", { name: "EcoTrade Local" }));
        expect(sources(onChange.mock.calls[0][0])).toEqual(["OUR_DATABASE", "CATDB_VIN", "CATDB_LOCAL", "ECOTRADE_LOCAL"]);
        expect(onChange.mock.calls[0][0][1].enabled).toBe(false);
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
