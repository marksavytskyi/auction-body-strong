import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CatdbAdminPage from "../page";
import * as admin from "@/lib/catalytic/catdbAdmin";
import { listBatches } from "@/lib/catalytic/catdbBatch";

vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/catalytic/CatdbProcessingControls", async () => {
    const actual = await vi.importActual("@/components/catalytic/CatdbProcessingControls");
    return { ...actual, default: () => null };
});
vi.mock("@/lib/catalytic/catdbBatch", () => ({ listBatches: vi.fn() }));
vi.mock("@/lib/catalytic/catdbAdmin", () => ({
    getStats: vi.fn(), listMachines: vi.fn(), createMachine: vi.fn(), setMachineActive: vi.fn(), rotateMachineToken: vi.fn(),
    listJobsPage: vi.fn(), enqueueJob: vi.fn(), cancelJob: vi.fn(),
    listJobTable: vi.fn(), getJobDetails: vi.fn(), retryJob: vi.fn(), archiveJobs: vi.fn(), unarchiveJobs: vi.fn(),
}));

// Phase K.48 — all CatDB jobs are reachable. Phase K.51 — the table filters by outcome,
// searches, sorts, archives and opens details; a retry needs an explicit paid-search tick.
// Nothing here talks to a real CatDB device: every call is mocked.

const OUTCOMES = ["COMPLETED", "COMPLETED", "TIMEOUT", "NO_RESULT"];
const JOBS = Array.from({ length: 291 }, (_, i) => ({
    id: 291 - i, vin: `1HGCM82633A${String(291 - i).padStart(6, "0")}`, status: i % 4 === 2 ? "MANUAL_REVIEW" : i % 4 === 3 ? "FAILED" : "COMPLETED",
    outcome: OUTCOMES[i % 4], attempt_count: 1, max_attempts: 3, worker_id: 8, worker_name: "phone-01", vehicle: "2019 Toyota RAV4",
    created_at: "2026-11-01T00:00:00", updated_at: "2026-11-01T00:05:00", error_code: i % 4 === 2 ? "TIMEOUT" : null, error_message: null,
    can_archive: true, can_retry: i % 4 >= 2, archived_at: null,
}));

const DETAILS = {
    ...JOBS[2], quota_note: "Counted against the subscription's paid searches: a search was submitted.",
    outcome_text: "The device timed out after submitting the search. The result is unknown; this does not mean the vehicle has no converter.",
    submission_count: 1, history: [{ id: JOBS[2].id, outcome: "TIMEOUT", created_at: "2026-11-01T00:00:00", retry_of_job_id: null }],
    evidence: null, operations_batch_ids: [12], active_job_for_vin: null, dispatch_paused: true, can_cancel: false,
};

beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    admin.getStats.mockResolvedValue({ pending: 0, running: 0, completed_today: 0, failed_today: 0 });
    admin.listMachines.mockResolvedValue([]);
    admin.listJobTable.mockImplementation(async ({ limit, offset }) => ({ items: JOBS.slice(offset, offset + limit), total: JOBS.length, limit, offset }));
    admin.getJobDetails.mockResolvedValue(DETAILS);
    admin.retryJob.mockResolvedValue({ id: 900, vin: DETAILS.vin });
    admin.archiveJobs.mockResolvedValue({ archived: 2, skipped_active_job_ids: [] });
    listBatches.mockResolvedValue([{ id: 9, status: "CANCELLED", requested_limit: 10, copart_import_id: 3, created_at: "2026-10-01T00:00:00" }]);
});

const jobsTable = () => screen.getAllByRole("table").at(-1);
const jobIds = () => within(jobsTable()).getAllByRole("row").slice(1)
    .map((tr) => Number(within(tr).getAllByRole("cell")[1].textContent.slice(-6)));
const noPaidAction = () => {
    expect(admin.enqueueJob).not.toHaveBeenCalled();
    expect(admin.retryJob).not.toHaveBeenCalled();
    expect(admin.cancelJob).not.toHaveBeenCalled();
};

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
        fireEvent.click(screen.getAllByRole("button", { name: "Load more" })[0]);
        expect(await screen.findByText("Showing all 291 of 291 jobs")).toBeInTheDocument();
        expect(jobIds()).toEqual(JOBS.map((j) => j.id));
        expect(Math.max(...admin.listJobTable.mock.calls.map(([args]) => args.limit))).toBeLessThanOrEqual(200);
    });

    it("the page size is remembered", async () => {
        const first = render(<CatdbAdminPage />);
        fireEvent.change(await screen.findByLabelText("Rows per page"), { target: { value: "10" } });
        expect(await screen.findByText(/^Showing 1–10 of 291 jobs/)).toBeInTheDocument();
        first.unmount();
        render(<CatdbAdminPage />);
        expect(await screen.findByText(/^Showing 1–10 of 291 jobs/)).toBeInTheDocument();
    });

    it("names timeouts, no-results and failures apart", async () => {
        render(<CatdbAdminPage />);
        await screen.findByText(/^Showing 1–100/);
        const t = jobsTable();
        expect(within(t).getAllByText("Timed out").length).toBeGreaterThan(0);
        expect(within(t).getAllByText("No result").length).toBeGreaterThan(0);
        expect(within(t).getAllByText("Completed").length).toBeGreaterThan(0);
    });

    it("searching, filtering and sorting only read, and go back to page one", async () => {
        render(<CatdbAdminPage />);
        await screen.findByText(/^Showing 1–100/);
        fireEvent.change(screen.getByLabelText("Status"), { target: { value: "TIMEOUT" } });
        await waitFor(() => expect(admin.listJobTable).toHaveBeenLastCalledWith(expect.objectContaining({ status: "TIMEOUT", offset: 0 })));
        fireEvent.change(screen.getByLabelText("Sort"), { target: { value: "oldest" } });
        await waitFor(() => expect(admin.listJobTable).toHaveBeenLastCalledWith(expect.objectContaining({ sort: "oldest" })));
        fireEvent.change(screen.getByLabelText("Search VIN"), { target: { value: "A000123" } });
        await waitFor(() => expect(admin.listJobTable).toHaveBeenLastCalledWith(expect.objectContaining({ search: "A000123" })), { timeout: 2000 });
        fireEvent.click(screen.getByLabelText("Show archived"));
        await waitFor(() => expect(admin.listJobTable).toHaveBeenLastCalledWith(expect.objectContaining({ include_archived: true })));
        noPaidAction();
    });

    it("columns can be hidden; VIN can't", async () => {
        render(<CatdbAdminPage />);
        await screen.findByText(/^Showing 1–100/);
        const headers = () => within(jobsTable()).getAllByRole("columnheader").map((h) => h.textContent);
        expect(headers()).toEqual(expect.arrayContaining(["VIN", "Vehicle", "Status", "Attempts", "Device", "Created", "Updated", "Error"]));
        fireEvent.click(screen.getByRole("button", { name: /columns/i }));
        fireEvent.click(screen.getByRole("menuitemcheckbox", { name: /Vehicle/ }));
        expect(headers()).not.toContain("Vehicle");
        expect(headers()).toContain("VIN");
    });

    it("details show the evidence and history, and opening them changes nothing", async () => {
        render(<CatdbAdminPage />);
        await screen.findByText(/^Showing 1–100/);
        fireEvent.click(within(jobsTable()).getAllByRole("button", { name: "Details" })[2]);
        const dialog = await screen.findByRole("dialog", { name: `CatDB job #${DETAILS.id}` });
        await within(dialog).findByText(/does not mean the vehicle has no converter/);
        expect(within(dialog).getByText(/Counted against the subscription/)).toBeInTheDocument();
        expect(within(dialog).getByText("No snapshot was stored for this job.")).toBeInTheDocument();
        expect(within(dialog).getByRole("link", { name: "Batch #12" })).toHaveAttribute("href", "/operations/12");
        noPaidAction();
    });

    it("retrying needs the paid-search tick, says it's paused, then queues one job", async () => {
        render(<CatdbAdminPage />);
        await screen.findByText(/^Showing 1–100/);
        fireEvent.click(within(jobsTable()).getAllByRole("button", { name: "Details" })[2]);
        const dialog = await screen.findByRole("dialog", { name: `CatDB job #${DETAILS.id}` });
        fireEvent.click(await within(dialog).findByRole("button", { name: "Retry VIN…" }));
        expect(within(dialog).getByText(/may use a paid search/)).toBeInTheDocument();
        expect(within(dialog).getByText(/CatDB is paused, so the new job waits/)).toBeInTheDocument();
        const go = within(dialog).getByRole("button", { name: "Queue the retry" });
        expect(go).toBeDisabled();
        fireEvent.click(go);
        expect(admin.retryJob).not.toHaveBeenCalled();
        fireEvent.click(within(dialog).getByLabelText("I understand this may use a paid CatDB search"));
        fireEvent.click(go);
        await waitFor(() => expect(admin.retryJob).toHaveBeenCalledTimes(1));
        expect(admin.retryJob).toHaveBeenCalledWith(DETAILS.id);
    });

    it("a VIN already searched shows the server's reason it can't be retried", async () => {
        admin.getJobDetails.mockResolvedValue({ ...DETAILS, can_retry: false, retry_block_reason: "A search was already submitted for this VIN and its outcome is unknown. A new search could pay twice, so the quota gate refuses it." });
        render(<CatdbAdminPage />);
        await screen.findByText(/^Showing 1–100/);
        fireEvent.click(within(jobsTable()).getAllByRole("button", { name: "Details" })[2]);
        const dialog = await screen.findByRole("dialog");
        expect(await within(dialog).findByRole("button", { name: "Retry VIN…" })).toBeDisabled();
        expect(within(dialog).getAllByText(/could pay twice/).length).toBeGreaterThan(0);
    });

    it("retry is offered nowhere when the VIN already has an active job", async () => {
        admin.getJobDetails.mockResolvedValue({ ...DETAILS, active_job_for_vin: 950 });
        render(<CatdbAdminPage />);
        await screen.findByText(/^Showing 1–100/);
        fireEvent.click(within(jobsTable()).getAllByRole("button", { name: "Details" })[2]);
        const dialog = await screen.findByRole("dialog");
        expect(await within(dialog).findByRole("button", { name: "Retry VIN…" })).toBeDisabled();
        expect(within(dialog).getAllByText(/Job #950 for this VIN is already queued or running/).length).toBeGreaterThan(0);
    });

    it("archiving selected jobs asks first and only archives", async () => {
        render(<CatdbAdminPage />);
        await screen.findByText(/^Showing 1–100/);
        fireEvent.click(within(jobsTable()).getByLabelText(`Select job ${JOBS[0].id}`));
        fireEvent.click(within(jobsTable()).getByLabelText(`Select job ${JOBS[1].id}`));
        fireEvent.click(screen.getByRole("button", { name: "Archive selected (2)" }));
        expect(admin.archiveJobs).not.toHaveBeenCalled();
        const dialog = screen.getByRole("dialog", { name: /Archive 2 jobs\?/ });
        fireEvent.click(within(dialog).getByRole("button", { name: "Archive" }));
        await waitFor(() => expect(admin.archiveJobs).toHaveBeenCalledWith({ jobIds: [JOBS[0].id, JOBS[1].id] }));
        noPaidAction();
    });

    it("archiving finished jobs uses the statuses chosen", async () => {
        render(<CatdbAdminPage />);
        await screen.findByText(/^Showing 1–100/);
        fireEvent.click(screen.getByRole("button", { name: "Archive finished jobs…" }));
        const dialog = screen.getByRole("dialog", { name: "Archive finished jobs?" });
        fireEvent.click(within(dialog).getByLabelText("Failed"));
        fireEvent.click(within(dialog).getByRole("button", { name: "Archive" }));
        await waitFor(() => expect(admin.archiveJobs).toHaveBeenCalledWith({ statuses: ["COMPLETED", "CANCELLED", "FAILED"] }));
    });

    it("queuing a new VIN asks about the paid search first", async () => {
        admin.enqueueJob.mockResolvedValue({ id: 901 });
        render(<CatdbAdminPage />);
        await screen.findByText(/^Showing 1–100/);
        fireEvent.change(screen.getByLabelText("VIN to queue"), { target: { value: "1HGCM82633A004352" } });
        fireEvent.click(screen.getByRole("button", { name: "Enqueue…" }));
        expect(admin.enqueueJob).not.toHaveBeenCalled();
        const dialog = screen.getByRole("dialog", { name: /Queue a CatDB search/ });
        expect(within(dialog).getByText(/may use a paid search/)).toBeInTheDocument();
        fireEvent.click(within(dialog).getByRole("button", { name: "Queue search" }));
        await waitFor(() => expect(admin.enqueueJob).toHaveBeenCalledWith({ vin: "1HGCM82633A004352" }));
    });

    it("machines show heartbeat, stop state and the global pause", async () => {
        admin.listMachines.mockResolvedValue([{
            id: 8, name: "phone-01", status: "ONLINE", effective_status: "ONLINE", is_active: true, dispatch_paused: false,
            stop_requested_at: null, stop_acknowledged_at: null, last_seen_at: new Date(Date.now() - 30000).toISOString(), current_job_id: null,
            device_identifier: "pixel", worker_version: "1", parser_version: "1", automation_profile_version: "1",
        }]);
        render(<CatdbAdminPage />);
        expect(await screen.findByText(/Last heartbeat:/)).toBeInTheDocument();
        expect(screen.getByText("No stop request")).toBeInTheDocument();
        expect(screen.getByText("running")).toBeInTheDocument();
    });

    it("legacy CatDB batches are read-only history", async () => {
        render(<CatdbAdminPage />);
        fireEvent.click(await screen.findByRole("button", { name: /Legacy CatDB batches/ }));
        const section = screen.getByLabelText("Legacy CatDB batches");
        expect(await within(section).findByText(/Batch #9 · CANCELLED/)).toBeInTheDocument();
        expect(within(section).queryAllByRole("button").map((b) => b.textContent)).toEqual([expect.stringMatching(/Legacy CatDB batches/)]);
    });

    it("a refused list shows its reason", async () => {
        const { CatalyticApiError } = await import("@/lib/catalytic/api");
        admin.listJobTable.mockRejectedValue(new CatalyticApiError("Admin access required", { status: 403 }));
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
        get.mockRestore();
    });
});

describe("job administration calls", () => {
    it("retry always sends the confirmation flag; archive and list hit the new routes", async () => {
        const actual = await vi.importActual("@/lib/catalytic/catdbAdmin");
        const http = await import("@/lib/catalytic/http");
        const post = vi.spyOn(http.axiosInstance, "post").mockResolvedValue({ data: {} });
        const get = vi.spyOn(http.axiosInstance, "get").mockResolvedValue({ data: { items: [], total: 0 } });
        await actual.retryJob(7);
        expect(post).toHaveBeenCalledWith("/catdb/admin/jobs/7/retry", { confirm_paid_search: true });
        await actual.archiveJobs({ statuses: ["COMPLETED"] });
        expect(post).toHaveBeenCalledWith("/catdb/admin/jobs/archive", { job_ids: undefined, statuses: ["COMPLETED"] });
        await actual.listJobTable({ status: "TIMEOUT" });
        expect(get).toHaveBeenCalledWith("/catdb/admin/job-list", { params: { status: "TIMEOUT" } });
        post.mockRestore();
        get.mockRestore();
    });
});
