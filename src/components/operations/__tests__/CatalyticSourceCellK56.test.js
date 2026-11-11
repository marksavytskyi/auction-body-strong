import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import CatalyticSourceCell, { describeSource, isCatdbNoCat } from "../CatalyticSourceCell";

// Phase K.56 — the CatDB VIN cell for Batch #23's real outcomes, before and after recovery.
const done = (fields) => ({ catdb_status: "DONE", catdb_total_price: null, ...fields });

describe("CatDB VIN cell (K.56)", () => {
    it("CatDB's no-cat answer reads 'No cat', never 'No data' or a converter count", () => {
        const ford = done({ catdb_price_min: 0, catdb_price_max: 0, catdb_catalyst_quantity: 0 });
        expect(isCatdbNoCat(ford)).toBe(true);
        render(<CatalyticSourceCell source="CATDB_VIN" vehicle={ford} />);
        expect(screen.getByText("No cat")).toBeInTheDocument();
        expect(describeSource("CATDB_VIN", ford).title).toContain("No cat on vehicle!");
    });

    it("a result CatDB returned but that couldn't be read is 'Requires review', not 'No data'", () => {
        const crvBefore = done({ catdb_price_min: null, catdb_price_max: null, catdb_catalyst_quantity: 2,
            catdb_price_warning: '2 fin: UNRECOGNIZED_PRICE_FORMAT: "Suckerfish, $46-$46"' });
        const { container } = render(<CatalyticSourceCell source="CATDB_VIN" vehicle={crvBefore} />);
        expect(container.querySelector("[data-state]").getAttribute("data-state")).toBe("REVIEW");
        expect(container.textContent).not.toContain("No data");
        expect(container.textContent).toContain("Suckerfish, $46-$46");
    });

    it("a total from only some converters says 'Partial price'", () => {
        const partial = done({ catdb_price_min: 49, catdb_price_max: 51, catdb_catalyst_quantity: 3,
            catdb_price_warning: "PRICE_PARTIAL: 1 of 3 converter row(s) have a CatDB price; the total covers only those" });
        render(<CatalyticSourceCell source="CATDB_VIN" vehicle={partial} />);
        expect(screen.getByText("Partial price")).toBeInTheDocument();
        expect(describeSource("CATDB_VIN", partial).title).toContain("not used automatically");
    });

    it("a recovered complete result shows the range and its converter count with no flag", () => {
        const odyssey = done({ catdb_price_min: 102, catdb_price_max: 500, catdb_catalyst_quantity: 3, catdb_price_warning: null });
        const { container } = render(<CatalyticSourceCell source="CATDB_VIN" vehicle={odyssey} />);
        expect(container.textContent).toBe("$102.00–$500.00 (3)");
        expect(isCatdbNoCat(odyssey)).toBe(false);
    });

    it("a finished search with no price and no warning still reads No data", () => {
        const { container } = render(<CatalyticSourceCell source="CATDB_VIN" vehicle={done({ catdb_price_min: null, catdb_price_max: null })} />);
        expect(container.querySelector("[data-state]").getAttribute("data-state")).toBe("NO_DATA");
    });
});
