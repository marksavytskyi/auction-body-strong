import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import CatalyticSourceCell from "../CatalyticSourceCell";

// Phase K.57 — a local "No match" says why, from the backend's stored reason.
const vehicle = (local) => ({ catalytic_local: [local] });

describe("local catalytic No match reasons (K.57)", () => {
    it("vehicle in the catalog without a CatDB converter", () => {
        const { container } = render(<CatalyticSourceCell source="CATDB_LOCAL" vehicle={vehicle({
            source: "CATDB_LOCAL", status: "NO_MATCH", no_match_reason: "NO_SOURCE_CONVERTERS",
            no_match_detail: "2013 HONDA ODYSSEY is in the catalog (4 converter(s) listed), but none of them comes from CatDB",
        })} />);
        expect(container.textContent).toContain("No match");
        expect(container.textContent).toContain("No CatDB converter listed");
        expect(container.querySelector("[title]").getAttribute("title")).toContain("none of them comes from CatDB");
    });

    it("model not in the catalog", () => {
        const { container } = render(<CatalyticSourceCell source="ECOTRADE_LOCAL" vehicle={vehicle({
            source: "ECOTRADE_LOCAL", status: "NO_MATCH", no_match_reason: "MODEL_NOT_IN_CATALOG", no_match_detail: "ACURA TLX is not in the local catalog",
        })} />);
        expect(container.textContent).toContain("Model not in catalog");
    });

    it("an older row without a reason still reads plain No match", () => {
        const { container } = render(<CatalyticSourceCell source="CATDB_LOCAL" vehicle={vehicle({ source: "CATDB_LOCAL", status: "NO_MATCH" })} />);
        expect(container.textContent).toBe("No matchLooked up: no match");
    });

    it("a lookup failure is Failed, never No match", () => {
        const { container } = render(<CatalyticSourceCell source="CATDB_LOCAL" vehicle={vehicle({ source: "CATDB_LOCAL", status: "FAILED" })} />);
        expect(container.querySelector("[data-state]").getAttribute("data-state")).toBe("FAILED");
    });

    it("an exact-VIN CatDB Local result shows its price", () => {
        const { container } = render(<CatalyticSourceCell source="CATDB_LOCAL" vehicle={vehicle({
            source: "CATDB_LOCAL", status: "COMPLETED", match_type: "VIN_EXACT", confidence: "HIGH", price_low: 102, price_expected: 301, price_high: 500,
        })} />);
        expect(container.textContent).toBe("$301.00");
    });
});
