import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CatdbAdminPage from "../page";
import * as admin from "@/lib/catalytic/catdbAdmin";

vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/catalytic/CatdbProcessingControls", () => ({ default: () => null }));
vi.mock("@/lib/catalytic/catdbAdmin", () => ({
    getStats: vi.fn(), listMachines: vi.fn(), createMachine: vi.fn(), setMachineActive: vi.fn(), rotateMachineToken: vi.fn(),
    listJobsPage: vi.fn(), enqueueJob: vi.fn(), cancelJob: vi.fn(),
}));

// Phase K.48 — all 291 CatDB jobs are reachable; the page used to stop at 100.
// Listing only reads: no job is queued, retried or cancelled.

const JOBS = Array.from({ length: 291 }, (_, i) => ({
    id: 291 - i, vin: `1HGCM82633A${String(291 - i).padStart(6, "0")}`, status: i % 4 ? "COMPLETED" : "FAILED",
    attempt_count: 1, max_attempts: 3, worker_id: 8, queued_at: "2026-11-01T00:00:00", error_message: null,
}));

beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    admin.getStats.mockResolvedValue({ pending: 0, running: 0, completed_today: 0, failed_today: 0 });
    admin.listMachines.mockResolvedValue([]);
    admin.listJobsPage.mockImplementation(async ({ limit, offset }) => ({ items: JOBS.slice(offset, offset + limit), total: JOBS.length }));
});

const jobIds = () => within(screen.getAllByRole("table").at(-1)).getAllByRole("row").slice(1)
    .map((tr) => Number(within(tr).getAllByRole("cell")[0].textContent.slice(-6)));

describe("CatDB jobs", () => {
    it("starts at 100 as before, says there are 291, and pages through the rest", async () => {
        render(<CatdbAdminPage />);
        expect(await screen.findByText(/^Showing 1–100 of 291 jobs/)).toBeInTheDocument();
        fireEvent.click(screen.getByLabelText("Next page"));
        expect(await screen.findByText(/^Showing 101–200 of 291 jobs/)).toBeInTheDocument();
        fireEvent.click(screen.getByLabelText("Next page"));
        expect(await screen.findByText(/^Showing 201–291 of 291 jobs/)).toBeInTheDocument();
        expect(jobIds().at(-1)).toBe(1);
    });

    it("offers 10, 25, 50, 100 and All, and All reaches the oldest job", async () => {
        render(<CatdbAdminPage />);
        const select = await screen.findByLabelText("Rows per page");
        expect(Array.from(select.options).map((o) => o.textContent)).toEqual(["10", "25", "50", "100", "All"]);
        fireEvent.change(select, { target: { value: "all" } });
        await screen.findByText("Showing 200 of 291 jobs");
        fireEvent.click(screen.getByRole("button", { name: "Load more" }));
        expect(await screen.findByText("Showing all 291 of 291 jobs")).toBeInTheDocument();
        expect(jobIds()).toEqual(JOBS.map((j) => j.id));
        expect(admin.listJobsPage.mock.calls.map(([args]) => args)).toContainEqual({ limit: 200, offset: 200 });
        expect(Math.max(...admin.listJobsPage.mock.calls.map(([args]) => args.limit))).toBeLessThanOrEqual(200);
    });

    it("smaller pages work too, and the choice is remembered", async () => {
        const first = render(<CatdbAdminPage />);
        fireEvent.change(await screen.findByLabelText("Rows per page"), { target: { value: "10" } });
        expect(await screen.findByText(/^Showing 1–10 of 291 jobs/)).toBeInTheDocument();
        first.unmount();
        render(<CatdbAdminPage />);
        expect(await screen.findByText(/^Showing 1–10 of 291 jobs/)).toBeInTheDocument();
    });

    it("listing never queues, retries or cancels a job", async () => {
        render(<CatdbAdminPage />);
        fireEvent.change(await screen.findByLabelText("Rows per page"), { target: { value: "all" } });
        await screen.findByText("Showing 200 of 291 jobs");
        fireEvent.click(screen.getByRole("button", { name: "Load more" }));
        await screen.findByText("Showing all 291 of 291 jobs");
        expect(admin.enqueueJob).not.toHaveBeenCalled();
        expect(admin.cancelJob).not.toHaveBeenCalled();
    });

    it("a refused list shows its reason", async () => {
        const { CatalyticApiError } = await import("@/lib/catalytic/api");
        admin.listJobsPage.mockRejectedValue(new CatalyticApiError("Admin access required", { status: 403 }));
        render(<CatdbAdminPage />);
        expect(await screen.findByText("Admin access required")).toBeInTheDocument();
    });
});

describe("listJobsPage", () => {
    it("reads the total from X-Total-Count and keeps the list as it was", async () => {
        const actual = await vi.importActual("@/lib/catalytic/catdbAdmin");
        const http = await import("@/lib/catalytic/http");
        const get = vi.spyOn(http.axiosInstance, "get").mockResolvedValue({ data: [{ id: 3 }, { id: 2 }], headers: { "x-total-count": "291" } });
        await expect(actual.listJobsPage({ limit: 2, offset: 0 })).resolves.toEqual({ items: [{ id: 3 }, { id: 2 }], total: 291 });
        expect(get).toHaveBeenCalledWith("/catdb/admin/jobs", { params: { limit: 2, offset: 0 } });
        get.mockResolvedValue({ data: [{ id: 1 }], headers: {} });
        await expect(actual.listJobsPage({ limit: 2, offset: 200 })).resolves.toEqual({ items: [{ id: 1 }], total: 201 });
        get.mockRestore();
    });
});