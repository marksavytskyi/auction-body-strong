import { describe, expect, it } from "vitest";

import { columnLabel, columnMatches } from "../columnLabels";
import { EMPTY_VALUE, formatField } from "../fieldFormat";

describe("formatField", () => {
    it.each([
        [0, "id", "0"],
        [12345, "id", "12345"],
        [2014, "year", "2014"],
        ["2014", "year", "2014"],
        [1.8, "disp", "1.8"],
        [3, "disp", "3.0"],
        [56455, "mileage", "56,455"],
        [899, "price_usd", "$899"],
        ["899.5", "price_usd", "$899.5"],
        [1721.25, "avg_engine_price_usd", "$1,721.25"],
        [0, "price_usd", "$0"],
        ["500", "model_norm", "500"],
        ["F-150", "model", "F-150"],
        [0.75, "confidence", "0.75"],
        [12, "engine_count", "12"],
    ])("%s as %s shows %s", (value, key, expected) => {
        expect(formatField(value, key)).toBe(expected);
    });

    it("never treats a price flag or level as money", () => {
        expect(formatField(true, "engine_price_missing")).toBe("Yes");
        expect(formatField("HIGH", "engine_price_confidence")).toBe("HIGH");
        expect(formatField(3, "engine_price_listing_count")).toBe("3");
    });

    it.each([[null], [undefined], [""], [NaN]])("shows one placeholder for %s", (value) => {
        expect(formatField(value, "price_usd")).toBe(EMPTY_VALUE);
        expect(formatField(value, "year")).toBe(EMPTY_VALUE);
    });

    it("keeps a value it can't parse rather than showing NaN", () => {
        expect(formatField("unknown", "mileage")).toBe("unknown");
    });
});

describe("columnLabel", () => {
    it.each([
        ["engine_price_missing", "Engine Price Missing"],
        ["transmission_price_missing", "Transmission Price Missing"],
        ["confidence", "Confidence"],
        ["match_confidence", "Match Confidence"],
        ["match_reason", "Match Reason"],
        ["engine_match_confidence", "Engine Match Confidence"],
        ["transmission_match_confidence", "Transmission Match Confidence"],
        ["engine_price_confidence", "Engine Price Confidence"],
        ["transmission_price_confidence", "Transmission Price Confidence"],
        ["avg_engine_price_usd", "Engine Price"],
        ["debug_json", "Details"],
        ["Lot URL", "Lot URL"],
        ["Engine type", "Engine type"],
    ])("%s reads %s", (field, label) => {
        expect(columnLabel(field)).toBe(label);
    });

    it("finds a column by its raw name or its label", () => {
        expect(columnMatches("avg_engine_price_usd", "engine price")).toBe(true);
        expect(columnMatches("avg_engine_price_usd", "avg_")).toBe(true);
        expect(columnMatches("match_reason", "engine")).toBe(false);
    });
});
