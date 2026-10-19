import { describe, expect, it } from "vitest";

import { formatMoney, completenessMeta, isCompleteRecovery, deriveWeightStatus, summarizeLegProgress } from "../format";
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

describe("deriveWeightStatus", () => {
    it("is Pending when weight_resolved_at is absent, regardless of weight_source", () => {
        expect(deriveWeightStatus({ weight_resolved_at: null, weight_source: "UNKNOWN" }).key).toBe("PENDING");
        expect(deriveWeightStatus({ weight_resolved_at: undefined, weight_source: "NHTSA" }).key).toBe("PENDING");
    });

    it("is the terminal No Data when weight_resolved_at is set but no curb weight was found — never Pending", () => {
        const status = deriveWeightStatus({ weight_resolved_at: "2026-01-01T00:00:00", curb_weight_lb: null, weight_source: "UNKNOWN" });
        expect(status.key).toBe("NO_DATA");
        expect(status.label.toLowerCase()).not.toContain("pending");
    });

    it("is NHTSA/Manual when weight_resolved_at is set and a curb weight was found", () => {
        expect(deriveWeightStatus({ weight_resolved_at: "2026-01-01T00:00:00", curb_weight_lb: 3500, weight_source: "NHTSA" }).key).toBe("NHTSA");
        expect(deriveWeightStatus({ weight_resolved_at: "2026-01-01T00:00:00", curb_weight_lb: 3500, weight_source: "MANUAL" }).key).toBe("MANUAL");
    });
});

describe("summarizeLegProgress", () => {
    const leg = (overrides) => ({ not_requested_count: 0, queued_count: 0, processing_count: 0, done_count: 0, failed_count: 0, no_data_count: 0, total: 0, ...overrides });

    it("reports Not started only when every vehicle is still not_requested", () => {
        expect(summarizeLegProgress(leg({ not_requested_count: 5, total: 5 })).label).toMatch(/not started/i);
    });

    it("reports a failed count when any vehicle failed", () => {
        expect(summarizeLegProgress(leg({ done_count: 3, failed_count: 2, total: 5 })).label).toMatch(/2 failed/i);
        expect(summarizeLegProgress(leg({ done_count: 3, failed_count: 2, total: 5 })).tone).toBe("danger");
    });

    it("reports Done with a done/total count once every vehicle reaches a terminal state", () => {
        expect(summarizeLegProgress(leg({ done_count: 5, total: 5 })).label).toMatch(/done \(5\/5\)/i);
    });

    it("reports Processing while any vehicle is actively processing", () => {
        expect(summarizeLegProgress(leg({ processing_count: 2, done_count: 1, total: 5 })).label).toMatch(/processing \(1\/5 done\)/i);
    });

    it("never fabricates a count when there are no vehicles at all", () => {
        expect(summarizeLegProgress(leg({ total: 0 })).label).toMatch(/no vehicles/i);
        expect(summarizeLegProgress(null).label).toMatch(/no vehicles/i);
    });
});
