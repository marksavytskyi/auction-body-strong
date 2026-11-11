import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import CatalyticSourceCell from "../CatalyticSourceCell";
import PaidRunDialog, { cacheHitVins, paidExclusions } from "../PaidRunDialog";

// Phase K.58 — CatDB Local is the cache of paid CatDB results: an inferred configuration
// match always says so and names the paid search it came from.
const vehicle = (local, extra = {}) => ({ catalytic_local: local ? [local] : [], ...extra });
const titleOf = (container) => container.querySelector("[title]")?.getAttribute("title") || "";

describe("CatDB Local configuration cache (K.58)", () => {
    it("an inferred match is labelled inferred, with the VIN and job it came from", () => {
        const { container } = render(<CatalyticSourceCell source="CATDB_LOCAL" vehicle={vehicle({
            source: "CATDB_LOCAL", status: "COMPLETED", match_type: "CONFIGURATION_MATCH", confidence: "MEDIUM",
            price_low: 120, price_expected: 150, price_high: 180, source_vin: "1HGCM82633A000001", source_job_id: 204, corroboration: 2,
        })} />);
        expect(container.textContent).toContain("$150.00");
        expect(container.textContent).toContain("Inferred");
        const title = titleOf(container);
        expect(title).toContain("From VIN 1HGCM82633A000001 (CatDB job #204)");
        expect(title).toContain("Backed by 2 paid searches that agree");
        expect(title).toContain("approximate");
        expect(title).not.toContain("Exact VIN");
    });

    it("a retired CatScan catalog match is shown as history, struck through", () => {
        const { container } = render(<CatalyticSourceCell source="CATDB_LOCAL" vehicle={vehicle({
            source: "CATDB_LOCAL", status: "COMPLETED", match_type: "MAKE_MODEL_ANY_YEAR", confidence: "LOW", price_expected: 232.83, retired: true,
        })} />);
        expect(container.textContent).toContain("Retired CatScan match");
        expect(container.querySelector(".line-through")).not.toBeNull();
        expect(titleOf(container)).toContain("never counted");
    });

    it.each([
        ["EXACT_VIN_UNDER_CATDB_VIN", "Exact VIN result is under CatDB VIN"],
        ["CONFLICTING_CACHED_RESULTS", "Paid results disagree"],
        ["ONLY_AMBIGUOUS_VARIANT_RESULTS", "Variant unverified"],
        ["SAME_MODEL_DIFFERENT_VIN_PATTERN", "Different VIN configuration"],
        ["NO_CACHED_CONFIGURATION", "No paid result for this configuration"],
        ["ENGINE_UNKNOWN", "Engine unknown"],
    ])("No match %s says why", (reason, hint) => {
        const { container } = render(<CatalyticSourceCell source="CATDB_LOCAL" vehicle={vehicle({ source: "CATDB_LOCAL", status: "NO_MATCH", no_match_reason: reason })} />);
        expect(container.textContent).toContain("No match");
        expect(container.textContent).toContain(hint);
    });

    it("CatDB VIN tells a reused stored result from a search made for the vehicle", () => {
        const base = { catdb_status: "DONE", catdb_price_min: 100, catdb_price_max: 140, catdb_job_id: 77, catdb_catalyst_quantity: 1 };
        const reused = render(<CatalyticSourceCell source="CATDB_VIN" vehicle={vehicle(null, { ...base, catdb_vin_origin: "STORED_RESULT_REUSED" })} />);
        expect(reused.container.textContent).toContain("Stored result reused");
        expect(titleOf(reused.container)).toContain("earlier paid search for this VIN (job #77); no new search");
        const searched = render(<CatalyticSourceCell source="CATDB_VIN" vehicle={vehicle(null, { ...base, catdb_vin_origin: "SEARCHED" })} />);
        expect(searched.container.textContent).not.toContain("Stored result reused");
    });
});

const preview = (over = {}) => ({
    fingerprint: "fp", max_approvable_new_searches: 1, available_quota: 295, reusable_count: 0, active_existing_job_count: 0,
    uncertain_count: 0, conclusive_no_data_count: 0, ineligible_count: 0, never_searched_count: 1, local_cache_hit_count: 2,
    forced_exact_vins: [],
    entries: [
        { vin: "1HGCM82633A004352", category: "LOCAL_CACHE_HIT" }, { vin: "1HGCM82633A004353", category: "LOCAL_CACHE_HIT" },
        { vin: "2T1BURHE0JC000003", category: "NEVER_SEARCHED" },
    ],
    ...over,
});

describe("paid searches leave out CatDB Local cache hits (K.58)", () => {
    it("cache hits are listed as not searched, and collected for a forced search", () => {
        expect(paidExclusions(preview())).toContainEqual(["answered free by CatDB Local: same configuration as an earlier paid search", 2]);
        expect(cacheHitVins(preview())).toEqual(["1HGCM82633A004352", "1HGCM82633A004353"]);
    });

    it("Force exact VIN search asks for a forced preview; it approves nothing itself", () => {
        const onForceExact = vi.fn();
        const onApprove = vi.fn();
        render(<PaidRunDialog preview={preview()} paused={true} busy={false} onApprove={onApprove} onForceExact={onForceExact} onClose={() => {}} />);
        fireEvent.click(screen.getByRole("button", { name: /Force exact VIN search for 2 VINs/ }));
        expect(onForceExact).toHaveBeenCalledWith(["1HGCM82633A004352", "1HGCM82633A004353"]);
        expect(onApprove).not.toHaveBeenCalled();
    });

    it("a forced preview needs its own second confirmation before Approve", () => {
        const onApprove = vi.fn();
        const forced = preview({ max_approvable_new_searches: 3, local_cache_hit_count: 0, forced_exact_vins: ["1HGCM82633A004352", "1HGCM82633A004353"], entries: [] });
        render(<PaidRunDialog preview={forced} paused={true} busy={false} onApprove={onApprove} onForceExact={() => {}} onClose={() => {}} />);
        const approve = screen.getByRole("button", { name: /Approve 3 searches/ });
        fireEvent.click(screen.getByRole("checkbox", { name: /I approve up to 3/ }));
        expect(approve).toBeDisabled();
        fireEvent.click(screen.getByRole("checkbox", { name: /I also confirm paying for exact searches of 2 VINs/ }));
        expect(approve).not.toBeDisabled();
        fireEvent.click(approve);
        expect(onApprove).toHaveBeenCalledTimes(1);
    });

    it("with only cache hits, nothing can be approved until an exact search is forced", () => {
        render(<PaidRunDialog preview={preview({ max_approvable_new_searches: 0, never_searched_count: 0 })} paused={false} busy={false}
            onApprove={() => {}} onForceExact={() => {}} onClose={() => {}} />);
        expect(screen.getByRole("checkbox", { name: /I approve up to 0/ })).toBeDisabled();
        expect(screen.getByRole("button", { name: /Approve 0 searches/ })).toBeDisabled();
    });
});
