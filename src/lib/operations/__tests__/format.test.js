import { describe, expect, it } from "vitest";

import { formatMoney, completenessMeta, isCompleteRecovery } from "../format";
import { COMPLETENESS } from "../constants";

describe("formatMoney", () => {
    it("never renders a missing value as $0", () => {
        expect(formatMoney(null)).toBe("—");
        expect(formatMoney(undefined)).toBe("—");
        expect(formatMoney("")).toBe("—");
    });

    it("renders a real zero as $0.00, distinct from missing", () => {
        expect(formatMoney(0)).toBe("$0.00");
    });

    it("formats a positive decimal value with two-decimal currency precision", () => {
        expect(formatMoney(1234.5)).toBe("$1,234.50");
        expect(formatMoney("275.00")).toBe("$275.00");
    });
});

describe("completenessMeta", () => {
    it("labels a PARTIAL estimate without any >= or similar symbol", () => {
        const meta = completenessMeta(COMPLETENESS.PARTIAL);
        expect(meta.label.toLowerCase()).toContain("partial");
        expect(meta.label).not.toMatch(/[<>]=?/);
    });

    it("distinguishes COMPLETE from PARTIAL and NO_DATA", () => {
        expect(completenessMeta(COMPLETENESS.COMPLETE).label.toLowerCase()).toContain("complete");
        expect(completenessMeta(COMPLETENESS.NO_DATA).label.toLowerCase()).toContain("no data");
    });
});

describe("isCompleteRecovery", () => {
    it("is true only when total_expected_recovery is a real, non-null backend value", () => {
        expect(isCompleteRecovery({ total_expected_recovery: 100 })).toBe(true);
        expect(isCompleteRecovery({ total_expected_recovery: 0 })).toBe(true);
        expect(isCompleteRecovery({ total_expected_recovery: null })).toBe(false);
        expect(isCompleteRecovery({})).toBe(false);
        expect(isCompleteRecovery(null)).toBe(false);
    });
});
