import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CatdbApprovalHistory from "../CatdbApprovalHistory";
import OperationsOverviewPage from "@/app/operations/page";
import ResultsSection from "@/app/dashboard/components/ResultsSection";
import { listOperationsBatches, listOperationsCatdbApprovals } from "@/lib/operations/api";
import { ALL, PAGE_SIZE_OPTIONS, parsePageSize, showingLabel } from "@/lib/pagination";
import { downloadName } from "@/lib/parts/downloadName";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/operations/ScrapPriceControl", () => ({ default: () => <div /> }));
vi.mock("@/lib/operations/api", () => ({
    listOperationsBatches: vi.fn(), listOperationsCatdbApprovals: vi.fn(), uploadOperationsBatch: vi.fn(),
}));

// Phase K.48 — every paginated table offers All.

const page = (items) => async ({ limit, offset } = {}) => ({ items: items.slice(offset, offset + limit), total: items.length, limit, offset });
const loadEverything = async () => {
    await screen.findByText(/^Showing (all )?\d+ of \d+ /);
    while (screen.queryByRole("button", { name: "Load more" })) {
        fireEvent.click(screen.getByRole("button", { name: "Load more" }));
        await waitFor(() => expect(screen.queryByText("Loading more…")).not.toBeInTheDocument());
    }
};

beforeEach(() => {
    window.localStorage.clear();
    listOperationsBatches.mockReset();
    listOperationsCatdbApprovals.mockReset();
});

describe("shared page sizes", () => {
    it("are 10, 25, 50, 100 and All", () => {
        expect(PAGE_SIZE_OPTIONS).toEqual([10, 25, 50, 100, ALL]);
        expect(parsePageSize("all")).toBe(ALL);
        expect(parsePageSize("25")).toBe(25);
        expect(parsePageSize("7")).toBeNull();
        expect(parsePageSize("all", [25, 50])).toBeNull();
        expect(parsePageSize(null)).toBeNull();
    });

    it("say what is shown", () => {
        expect(showingLabel({ pageSize: 25, page: 1, shown: 25, total: 437, noun: "vehicle" })).toBe("Showing 26–50 of 437 vehicles");
        expect(showingLabel({ pageSize: ALL, shown: 437, total: 437, noun: "vehicle" })).toBe("Showing all 437 of 437 vehicles");
        expect(showingLabel({ pageSize: ALL, shown: 200, total: 437, noun: "vehicle" })).toBe("Showing 200 of 437 vehicles");
        expect(showingLabel({ pageSize: ALL, shown: 1, total: 1, noun: "batch", plural: "batches" })).toBe("Showing all 1 of 1 batch");
        expect(showingLabel({ pageSize: 25, shown: 0, total: 0, noun: "batch", plural: "batches" })).toBe("No batches");
    });
});

describe("Operations batch list", () => {
    const batches = Array.from({ length: 120 }, (_, i) => ({
        id: 120 - i, status: "DONE", total_vehicles: 10, created_at: "2026-11-01T00:00:00", created_by_email: "a@b.com",
    }));

    it("used to stop at 50; now every batch is reachable, by page or with All", async () => {
        listOperationsBatches.mockImplementation(page(batches));
        render(<OperationsOverviewPage />);
        expect(await screen.findByText(/^Showing 1–50 of 120 batches/)).toBeInTheDocument();
        expect(screen.queryByText("Batch #70")).not.toBeInTheDocument();
        fireEvent.click(screen.getByLabelText("Next page"));
        expect(await screen.findByText("Batch #70")).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText("Rows per page"), { target: { value: "all" } });
        await loadEverything();
        expect(screen.getByText("Showing all 120 of 120 batches")).toBeInTheDocument();
        expect(screen.getAllByText(/^Batch #\d+$/)).toHaveLength(120);
        expect(screen.getByText("Batch #1")).toBeInTheDocument();
        expect(Math.max(...listOperationsBatches.mock.calls.map(([args]) => args.limit))).toBeLessThanOrEqual(200);
    });

    it("an empty list still says so", async () => {
        listOperationsBatches.mockImplementation(page([]));
        render(<OperationsOverviewPage />);
        expect(await screen.findByText(/no operations batches yet/i)).toBeInTheDocument();
    });
});

describe("CatDB approval history", () => {
    const approvals = Array.from({ length: 23 }, (_, i) => ({
        id: 23 - i, status: i === 22 ? "NEEDS_RECONCILIATION" : "COMPLETED", created_at: "2026-11-01T00:00:00",
        requested_max_new_searches: 5, new_search_count: 1, reused_completed_count: 0, attached_active_job_count: 0,
        blocked_count: 0, ineligible_count: 0, quota_exhausted_count: 0, needs_reconciliation: i === 22,
    }));

    it("shows every approval with All, and the page sees all of them for its own checks", async () => {
        listOperationsCatdbApprovals.mockImplementation((_batchId, args) => page(approvals)(args));
        const onApprovalsLoaded = vi.fn();
        render(<CatdbApprovalHistory batchId={4} refreshKey={0} onApprovalsLoaded={onApprovalsLoaded} />);
        expect(await screen.findByText(/^Showing 1–10 of 23 approvals/)).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText("Rows per page"), { target: { value: "all" } });
        expect(await screen.findByText("Showing all 23 of 23 approvals")).toBeInTheDocument();
        expect(screen.getByText("#1")).toBeInTheDocument();
        const last = onApprovalsLoaded.mock.calls.at(-1)[0];
        expect(last).toHaveLength(23);
        expect(last.some((a) => a.status === "NEEDS_RECONCILIATION")).toBe(true);
        expect(listOperationsCatdbApprovals).toHaveBeenLastCalledWith(4, { limit: 200, offset: 0 });
    });
});

describe("Parts results", () => {
    const headers = ["Lot URL", "VIN", "avg_engine_price_usd", "debug_json"];
    const row = (n) => ({ "Lot URL": `https://x/${n}`, VIN: `VIN${n}`, avg_engine_price_usd: String(100 + n), debug_json: "{}" });
    const props = (overrides) => ({
        jobId: "1", jobStatus: "done", jobRows: 250, jobCols: 4, headers, query: "", setQuery: vi.fn(), page: 1, setPage: vi.fn(),
        setPageSize: vi.fn(), isProcessing: false, elapsedSec: 0, downloadResult: vi.fn(), openModal: vi.fn(),
        pageSizeOptions: [10, 25, 50, 100, 200, ALL], ...overrides,
    });

    it("keeps its 200 and adds All", () => {
        const setPageSize = vi.fn();
        render(<ResultsSection {...props({ rows: [row(1)], totalRows: 1, pageSize: 25, setPageSize })} />);
        const select = screen.getByLabelText("Page size");
        expect(Array.from(select.options).map((o) => o.textContent)).toEqual(["10", "25", "50", "100", "200", "All"]);
        fireEvent.change(select, { target: { value: "all" } });
        expect(setPageSize).toHaveBeenCalledWith(ALL);
    });

    it("All shows one table with no pages, and asks for more at the end", () => {
        const onLoadMore = vi.fn();
        render(<ResultsSection {...props({ rows: [row(1), row(2), row(3)], totalRows: 250, pageSize: ALL, hasMore: true, onLoadMore })} />);
        expect(screen.getByText("Showing 3 of 250 rows")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Load more" }));
        expect(onLoadMore).toHaveBeenCalled();
        const numbers = screen.getAllByRole("row").slice(1).map((tr) => within(tr).getAllByRole("cell")[0].textContent);
        expect(numbers).toEqual(["1", "2", "3"]);
    });

    it("sorting asks the server, and rows stay in the order it sent them", () => {
        const onSortChange = vi.fn();
        const rows = [row(3), row(1), row(2)];
        const { rerender } = render(<ResultsSection {...props({ rows, totalRows: 250, pageSize: ALL, hasMore: true, onLoadMore: vi.fn(), onSortChange })} />);
        fireEvent.click(screen.getAllByTitle("Sort by column")[2]);
        expect(onSortChange).toHaveBeenLastCalledWith({ key: "avg_engine_price_usd", direction: "asc" });
        const sorted = { key: "avg_engine_price_usd", direction: "asc" };
        rerender(<ResultsSection {...props({ rows, totalRows: 250, pageSize: ALL, hasMore: true, onLoadMore: vi.fn(), onSortChange, sortConfig: sorted })} />);
        fireEvent.click(screen.getAllByTitle("Sort by column")[2]);
        expect(onSortChange).toHaveBeenLastCalledWith({ key: "avg_engine_price_usd", direction: "desc" });
        const vins = screen.getAllByRole("row").slice(1).map((tr) => within(tr).getAllByRole("cell")[2].textContent);
        expect(vins).toEqual(["VIN3", "VIN1", "VIN2"]);
        expect(screen.queryByText(/sorted within the loaded rows/)).not.toBeInTheDocument();
    });
});

describe("Parts download name", () => {
    it("is the one the server sends, the same the email uses", () => {
        expect(downloadName(`attachment; filename="enriched_Copart lots.csv"; filename*=UTF-8''enriched_Copart%20lots.csv`, "x.csv")).toBe("enriched_Copart lots.csv");
        expect(downloadName(`attachment; filename="enriched_.csv"; filename*=UTF-8''enriched_%D0%BB%D0%BE%D1%82%D1%8B.csv`, "x.csv")).toBe("enriched_лоты.csv");
        expect(downloadName('attachment; filename="enriched_a.csv"', "x.csv")).toBe("enriched_a.csv");
        expect(downloadName(undefined, "enriched_1.csv")).toBe("enriched_1.csv");
    });
});
