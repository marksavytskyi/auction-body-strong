import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DashboardPage from "../page";
import axiosInstance from "@/utils/axios";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("next/dynamic", () => ({ default: () => function Stub() { return null; } }));
vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn(), loading: vi.fn(), dismiss: vi.fn() } }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ ready: true, isLoggedIn: true, email: "owner@example.com", role: "OWNER", roleReady: true }) }));
vi.mock("@/components/shell/ModuleSwitcher", () => ({ default: () => null }));
vi.mock("@/utils/axios", () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));

// Phase K.48 — Parts results are sorted by the server across every matching row,
// so the first page, every later page and every All chunk share one order.

const JOB = "77777777-7777-4777-8777-777777777777";
const HEADERS = ["VIN", "avg_engine_price_usd", "debug_json"];
// The cheapest vehicle is near the end of the file, so sorting one page couldn't find it.
const FILE = Array.from({ length: 250 }, (_, n) => ({ VIN: `VIN${String(n).padStart(4, "0")}`, avg_engine_price_usd: String(n === 240 ? 1 : 100 + ((n * 37) % 500)), debug_json: "{}" }));

const previewCalls = [];
function servePreview({ page, page_size, query, sort, direction }) {
    previewCalls.push({ page, page_size, query, sort, direction });
    let rows = FILE.filter((r) => !query || Object.values(r).join(" ").toLowerCase().includes(query));
    if (sort) {
        rows = rows.map((r, i) => [r, i]).sort(([a, i], [b, j]) => ((Number(a[sort]) - Number(b[sort])) * (direction === "desc" ? -1 : 1)) || i - j).map(([r]) => r);
    }
    const start = (page - 1) * page_size;
    return { job_id: JOB, status: "done", headers: HEADERS, rows: rows.slice(start, start + page_size), total_rows: rows.length, total_rows_in_file: 250, page, page_size, sort: sort || null };
}

beforeEach(() => {
    previewCalls.length = 0;
    window.localStorage.clear();
    window.localStorage.setItem("dashboard:active-job-id", JOB);
    axiosInstance.get.mockImplementation(async (url, config) => {
        if (url === "/csv-vehicle/jobs") return { data: [] };
        if (url === `/csv-vehicle/jobs/${JOB}`) return { data: { job_id: JOB, status: "done", rows: 250, columns: 3 } };
        if (url === `/csv-vehicle/jobs/${JOB}/preview`) return { data: servePreview(config.params) };
        throw new Error(`unexpected ${url}`);
    });
});

const resultsTable = () => screen.getAllByRole("table").find((t) => within(t).queryByText("#"));
const shownVins = () => within(resultsTable()).getAllByRole("row").slice(1).map((tr) => within(tr).getAllByRole("cell")[1].textContent);
const sortByPrice = () => fireEvent.click(within(resultsTable()).getAllByTitle("Sort by column")[1]);
const sortedVins = (direction) => [...FILE].map((r, i) => [r, i])
    .sort(([a, i], [b, j]) => ((Number(a.avg_engine_price_usd) - Number(b.avg_engine_price_usd)) * (direction === "desc" ? -1 : 1)) || i - j)
    .map(([r]) => r.VIN);

describe("Parts results sorting", () => {
    it("asks the server to sort every row, and shows the cheapest vehicle first even though it is on page 10", async () => {
        render(<DashboardPage />);
        await waitFor(() => expect(shownVins()).toHaveLength(25));
        expect(shownVins()[0]).toBe("VIN0000");
        sortByPrice();
        await waitFor(() => expect(shownVins()[0]).toBe("VIN0240"));
        expect(previewCalls.at(-1)).toMatchObject({ page: 1, sort: "avg_engine_price_usd", direction: "asc" });
        expect(shownVins()).toEqual(sortedVins("asc").slice(0, 25));
    });

    it("the next page continues the same order, and sorting again goes to page 1 descending", async () => {
        render(<DashboardPage />);
        await waitFor(() => expect(shownVins()).toHaveLength(25));
        sortByPrice();
        await waitFor(() => expect(shownVins()[0]).toBe("VIN0240"));
        fireEvent.click(screen.getAllByRole("button", { name: "Next" })[0]);
        await waitFor(() => expect(shownVins()).toEqual(sortedVins("asc").slice(25, 50)));
        sortByPrice();
        await waitFor(() => expect(shownVins()).toEqual(sortedVins("desc").slice(0, 25)));
        expect(previewCalls.at(-1)).toMatchObject({ page: 1, direction: "desc" });
    });

    it("with All, every chunk carries the sort and together they are one sorted list", async () => {
        render(<DashboardPage />);
        await waitFor(() => expect(shownVins()).toHaveLength(25));
        sortByPrice();
        await waitFor(() => expect(shownVins()[0]).toBe("VIN0240"));
        fireEvent.change(screen.getAllByLabelText("Page size")[0], { target: { value: "all" } });
        await screen.findByText("Showing 100 of 250 rows");
        while (screen.queryAllByRole("button", { name: "Load more" }).length) {
            fireEvent.click(screen.getAllByRole("button", { name: "Load more" })[0]);
            await waitFor(() => expect(screen.queryByText("Loading more…")).not.toBeInTheDocument());
        }
        expect(screen.getByText("Showing all 250 of 250 rows")).toBeInTheDocument();
        expect(shownVins()).toEqual(sortedVins("asc"));
        const chunks = previewCalls.filter((c) => c.page_size === 100);
        expect(chunks.map((c) => c.page)).toEqual([1, 2, 3]);
        expect(chunks.every((c) => c.sort === "avg_engine_price_usd" && c.direction === "asc")).toBe(true);
    });

    it("keeps the search while sorting", async () => {
        render(<DashboardPage />);
        await waitFor(() => expect(shownVins()).toHaveLength(25));
        fireEvent.change(screen.getAllByPlaceholderText("Search in table...")[0], { target: { value: "vin00" } });
        await waitFor(() => expect(previewCalls.at(-1).query).toBe("vin00"));
        sortByPrice();
        await waitFor(() => expect(previewCalls.at(-1)).toMatchObject({ query: "vin00", sort: "avg_engine_price_usd" }));
        const prices = within(resultsTable()).getAllByRole("row").slice(1).map((tr) => Number(within(tr).getAllByRole("cell")[2].textContent));
        expect(prices).toEqual([...prices].sort((a, b) => a - b));
    });
});
