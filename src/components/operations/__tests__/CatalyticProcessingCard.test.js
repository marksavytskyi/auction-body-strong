import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CatalyticProcessingCard, { catalyticHeadline } from "../CatalyticProcessingCard";
import {
    approveOperationsCatdbSearches,
    cancelOperationsCatalyticRemaining,
    getOperationsCatalytic,
    planOperationsCatalytic,
    previewOperationsCatdbSearches,
    runOperationsCatalyticAnalysis,
    saveOperationsCatalyticSources,
} from "@/lib/operations/api";
import { CatalyticApiError } from "@/lib/catalytic/http";
import toast from "react-hot-toast";

vi.mock("@/lib/operations/api", () => ({
    approveOperationsCatdbSearches: vi.fn(),
    cancelOperationsCatalyticRemaining: vi.fn(),
    getOperationsCatalytic: vi.fn(),
    planOperationsCatalytic: vi.fn(),
    previewOperationsCatdbSearches: vi.fn(),
    runOperationsCatalyticAnalysis: vi.fn(),
    saveOperationsCatalyticSources: vi.fn(),
    listOperationsCatdbApprovals: vi.fn().mockResolvedValue({ items: [], total: 0 }),
}));
vi.mock("../CatdbApprovalHistory", () => ({ default: () => <div data-testid="paid-history" /> }));
vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn() } }));

// Phase K.52 — one Run Catalytic Analysis for free and paid sources, one paid confirmation.
// Every call is mocked: nothing here reaches a real CatDB device or quota.

const source = (name, selected, status = "READY", extra = {}) => ({ source: name, selected, status, counts: {}, priced: 0, ...extra });

function overview(overrides = {}) {
    return {
        operations_batch_id: 7,
        total_vehicles: 357,
        sources: [
            source("OUR_DATABASE", true, "PARTIAL", { priced: 120 }),
            source("CATDB_VIN", false, "NOT_REQUESTED"),
            source("CATDB_LOCAL", true, "COMPLETED", { priced: 41 }),
            source("ECOTRADE_LOCAL", false, "NOT_REQUESTED"),
        ],
        global_paused: false,
        workers: [{ id: 8, name: "phone", stop_state: "NONE" }],
        paid_block_reason: null,
        active_job_count: 0,
        scope_counts: { ALL: 357, NO_LOCAL_MATCH: 100, FAILED: 3, PAID_FAILED: 0 },
        ...overrides,
    };
}

const PREVIEW = {
    fingerprint: "fp-abc", total_operations_rows: 357, reusable_count: 200, active_existing_job_count: 1, uncertain_count: 37,
    conclusive_no_data_count: 7, never_searched_count: 110, ineligible_count: 2, available_quota: 100, max_approvable_new_searches: 100,
    quota_period_key: "1:2026-11", quota_reconciliation_status: "RECONCILED", entries: [],
};

function servePlan(toProcess = 50) {
    planOperationsCatalytic.mockImplementation(async (_id, { sources, scope }) => {
        const free = sources.filter((s) => s !== "CATDB_VIN");
        return {
            scope, vehicles_in_scope: 357, vehicles_to_process: free.length ? toProcess : 0,
            sources: free.map((s) => ({ source: s, to_process: toProcess, in_progress: 0, with_result: 0, priced: 0 })),
            blocked_reason: !free.length ? "Select at least one source." : toProcess ? null : "Every vehicle in this scope has already been looked up in the selected sources.",
        };
    });
}

async function open(props = {}) {
    render(<CatalyticProcessingCard batchId={7} refreshKey={0} onChanged={vi.fn()} {...props} />);
    const header = await screen.findByRole("button", { name: /Catalytic Processing/ });
    fireEvent.click(header);
    return header;
}
const runButton = async () => {
    const button = await screen.findByRole("button", { name: "Run Catalytic Analysis" });
    await waitFor(() => expect(button).toBeEnabled());
    return button;
};
const tick = (label) => fireEvent.click(screen.getByRole("checkbox", { name: new RegExp(label) }));

beforeEach(() => {
    vi.clearAllMocks();
    getOperationsCatalytic.mockResolvedValue(overview());
    servePlan();
    runOperationsCatalyticAnalysis.mockResolvedValue({
        scope: "ALL", vehicles_in_scope: 357, vehicles_to_process: 50,
        sources: [{ source: "OUR_DATABASE", state: "STARTED", vehicles: 50 }, { source: "CATDB_LOCAL", state: "COMPLETED", vehicles: 50, matched: 10, no_match: 40, failed: 0 }],
    });
    previewOperationsCatdbSearches.mockResolvedValue(PREVIEW);
    approveOperationsCatdbSearches.mockResolvedValue({ id: 3, new_search_count: 100, status: "IN_PROGRESS" });
    saveOperationsCatalyticSources.mockResolvedValue({});
});

describe("Catalytic Processing", () => {
    it("is closed by default, and the header shows the real state", async () => {
        render(<CatalyticProcessingCard batchId={7} refreshKey={0} onChanged={vi.fn()} />);
        const header = await screen.findByRole("button", { name: /Catalytic Processing/ });
        expect(header).toHaveAttribute("aria-expanded", "false");
        expect(screen.queryByRole("button", { name: "Run Catalytic Analysis" })).toBeNull();
        expect(header).toHaveTextContent("Priced: Our Database 120 · CatDB Local 41");
        expect(header).toHaveTextContent("Partial");
    });

    it("the collapsed header keeps running paid work and failures visible", () => {
        expect(catalyticHeadline(overview({ active_job_count: 12, global_paused: true }))).toMatchObject({
            status: { label: "Running" }, summary: expect.stringContaining("12 paid searches waiting or running (CatDB paused)"),
        });
        const failed = overview({ sources: [source("OUR_DATABASE", true, "FAILED"), source("CATDB_VIN", false, "NOT_REQUESTED"), source("CATDB_LOCAL", false, "NOT_REQUESTED"), source("ECOTRADE_LOCAL", false, "NOT_REQUESTED")] });
        expect(catalyticHeadline(failed).status.label).toBe("Failed");
        const review = overview({ sources: [source("OUR_DATABASE", true, "COMPLETE"), source("CATDB_VIN", true, "REVIEW_REQUIRED"), source("CATDB_LOCAL", false, "NOT_REQUESTED"), source("ECOTRADE_LOCAL", false, "NOT_REQUESTED")] });
        expect(catalyticHeadline(review).status.label).toBe("Requires Review");
        const fresh = overview({ sources: ["OUR_DATABASE", "CATDB_VIN", "CATDB_LOCAL", "ECOTRADE_LOCAL"].map((s) => source(s, s === "OUR_DATABASE", s === "OUR_DATABASE" ? "NOT_STARTED" : "NOT_REQUESTED")) });
        expect(catalyticHeadline(fresh).status.label).toBe("Not Started");
    });

    it("lists four sources marked free or paid, and the old competing buttons are gone", async () => {
        await open();
        for (const [label, kind] of [["Our Database", "FREE"], ["CatDB Local", "FREE"], ["EcoTrade Local", "FREE"], ["CatDB VIN", "PAID"]]) {
            expect(screen.getByRole("checkbox", { name: new RegExp(label) }).closest("label")).toHaveTextContent(kind);
        }
        for (const gone of ["Save Sources", /Start CatDB VIN Search/, "Refresh CatDB Results", "Approve New Searches", "Pause", "Stop"]) {
            expect(screen.queryByRole("button", { name: gone })).toBeNull();
        }
        expect(screen.getAllByRole("button", { name: /Run Catalytic Analysis/ })).toHaveLength(1);
    });

    it("free sources run straight away, with no paid confirmation and no paid call", async () => {
        await open();
        fireEvent.click(await runButton());
        await waitFor(() => expect(runOperationsCatalyticAnalysis).toHaveBeenCalledWith(7, { sources: ["OUR_DATABASE", "CATDB_LOCAL"], scope: "ALL", vehicleIds: undefined }));
        expect(screen.queryByRole("dialog")).toBeNull();
        expect(previewOperationsCatdbSearches).not.toHaveBeenCalled();
        expect(approveOperationsCatdbSearches).not.toHaveBeenCalled();
        expect(await screen.findByRole("status", { name: "Last catalytic analysis" })).toHaveTextContent("CatDB Local: looked up 50 vehicles · 10 matched");
    });

    it("ticking boxes starts and saves nothing until Run", async () => {
        await open();
        tick("EcoTrade Local");
        tick("CatDB VIN");
        await waitFor(() => expect(planOperationsCatalytic).toHaveBeenCalled());
        expect(saveOperationsCatalyticSources).not.toHaveBeenCalled();
        expect(runOperationsCatalyticAnalysis).not.toHaveBeenCalled();
        expect(previewOperationsCatdbSearches).not.toHaveBeenCalled();
    });

    it("with CatDB VIN ticked, Run shows one confirmation with the real numbers before anything paid", async () => {
        await open();
        tick("CatDB VIN");
        fireEvent.click(await runButton());
        const dialog = await screen.findByRole("dialog", { name: "Approve paid CatDB VIN searches?" });
        expect(previewOperationsCatdbSearches).toHaveBeenCalledWith(7, { scope: "ALL", vehicleIds: undefined });
        expect(within(dialog).getByText("Paid searches, at most").nextSibling).toHaveTextContent("100");
        expect(within(dialog).getByText("Quota left this period").nextSibling).toHaveTextContent("100");
        expect(dialog).toHaveTextContent("257 VINs won't be searched");
        for (const line of ["200 already searched", "1 already queued or running", "37 searched before with an unknown outcome", "7 CatDB already answered", "2 not searchable", "10 over this period's remaining quota"]) {
            expect(dialog).toHaveTextContent(line);
        }
        expect(dialog).toHaveTextContent("CatDB is running, so a device may start these searches right away.");
        expect(dialog).toHaveTextContent("Free sources look up 50 vehicles at no cost.");
        expect(approveOperationsCatdbSearches).not.toHaveBeenCalled();
        expect(runOperationsCatalyticAnalysis).not.toHaveBeenCalled();
    });

    it("approving needs the tick, sends exactly the preview's fingerprint and number, then runs the free sources", async () => {
        await open();
        tick("CatDB VIN");
        fireEvent.click(await runButton());
        const dialog = await screen.findByRole("dialog");
        const approve = within(dialog).getByRole("button", { name: "Approve 100 searches & run" });
        expect(approve).toBeDisabled();
        fireEvent.click(approve);
        expect(approveOperationsCatdbSearches).not.toHaveBeenCalled();
        fireEvent.click(within(dialog).getByRole("checkbox", { name: /I approve up to 100 paid CatDB VIN searches/ }));
        fireEvent.click(approve);
        await waitFor(() => expect(approveOperationsCatdbSearches).toHaveBeenCalledTimes(1));
        expect(approveOperationsCatdbSearches).toHaveBeenCalledWith(7, { previewFingerprint: "fp-abc", maxNewSearches: 100, confirm: true, scope: "ALL", vehicleIds: undefined });
        // CatDB VIN wasn't a saved source, so it is saved first: configuration only.
        expect(saveOperationsCatalyticSources).toHaveBeenCalledWith(7, { run_ourdb: true, run_catdb_local: true, run_ecotrade_local: false, run_catdb: true });
        await waitFor(() => expect(runOperationsCatalyticAnalysis).toHaveBeenCalledWith(7, { sources: ["OUR_DATABASE", "CATDB_LOCAL", "CATDB_VIN"], scope: "ALL", vehicleIds: undefined }));
        const last = await screen.findByRole("status", { name: "Last catalytic analysis" });
        expect(last).toHaveTextContent("CatDB VIN: 100 paid searches queued.");
        expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("an approval is never reused: the next Run fetches a fresh preview", async () => {
        await open();
        tick("CatDB VIN");
        fireEvent.click(await runButton());
        let dialog = await screen.findByRole("dialog");
        fireEvent.click(within(dialog).getByRole("checkbox"));
        fireEvent.click(within(dialog).getByRole("button", { name: /Approve/ }));
        await waitFor(() => expect(approveOperationsCatdbSearches).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
        fireEvent.click(await runButton());
        dialog = await screen.findByRole("dialog");
        expect(previewOperationsCatdbSearches).toHaveBeenCalledTimes(2);
        expect(within(dialog).getByRole("checkbox")).not.toBeChecked();
        expect(approveOperationsCatdbSearches).toHaveBeenCalledTimes(1);
    });

    it("Cancel approves nothing and runs nothing", async () => {
        await open();
        tick("CatDB VIN");
        fireEvent.click(await runButton());
        const dialog = await screen.findByRole("dialog");
        fireEvent.click(within(dialog).getByRole("checkbox"));
        fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
        expect(screen.queryByRole("dialog")).toBeNull();
        expect(approveOperationsCatdbSearches).not.toHaveBeenCalled();
        expect(runOperationsCatalyticAnalysis).not.toHaveBeenCalled();
    });

    it("Run free sources only queues nothing paid", async () => {
        await open();
        tick("CatDB VIN");
        fireEvent.click(await runButton());
        fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Run free sources only" }));
        await waitFor(() => expect(runOperationsCatalyticAnalysis).toHaveBeenCalled());
        expect(approveOperationsCatdbSearches).not.toHaveBeenCalled();
        expect(await screen.findByRole("status", { name: "Last catalytic analysis" })).toHaveTextContent("CatDB VIN: skipped this time. Nothing paid was queued.");
    });

    it("a refused approval is shown, never retried, and the free results still run", async () => {
        approveOperationsCatdbSearches.mockRejectedValue(new CatalyticApiError("preview fingerprint no longer matches", { status: 409 }));
        await open();
        tick("CatDB VIN");
        fireEvent.click(await runButton());
        const dialog = await screen.findByRole("dialog");
        fireEvent.click(within(dialog).getByRole("checkbox"));
        fireEvent.click(within(dialog).getByRole("button", { name: /Approve/ }));
        await waitFor(() => expect(runOperationsCatalyticAnalysis).toHaveBeenCalledTimes(1));
        expect(approveOperationsCatdbSearches).toHaveBeenCalledTimes(1);
        const last = await screen.findByRole("status", { name: "Last catalytic analysis" });
        expect(last).toHaveTextContent("the batch changed since the count, so nothing paid was queued");
        expect(last).toHaveTextContent("Our Database: looking up 50 vehicles");
        expect(toast.error).toHaveBeenCalled();
    });

    it("free results stand when the paid source can't start, and no confirmation is shown", async () => {
        getOperationsCatalytic.mockResolvedValue(overview({ paid_block_reason: "CatDB processing is globally paused." }));
        await open();
        tick("CatDB VIN");
        expect(await screen.findByText(/CatDB VIN can't run now: CatDB processing is globally paused/)).toBeInTheDocument();
        fireEvent.click(await runButton());
        await waitFor(() => expect(runOperationsCatalyticAnalysis).toHaveBeenCalled());
        expect(screen.queryByRole("dialog")).toBeNull();
        expect(previewOperationsCatdbSearches).not.toHaveBeenCalled();
        expect(approveOperationsCatdbSearches).not.toHaveBeenCalled();
        expect(await screen.findByRole("status", { name: "Last catalytic analysis" })).toHaveTextContent("Nothing paid was queued.");
    });

    it("nothing new to search means no confirmation and no approval, with the reasons", async () => {
        previewOperationsCatdbSearches.mockResolvedValue({ ...PREVIEW, never_searched_count: 0, max_approvable_new_searches: 0 });
        await open();
        tick("CatDB VIN");
        fireEvent.click(await runButton());
        await waitFor(() => expect(runOperationsCatalyticAnalysis).toHaveBeenCalled());
        expect(screen.queryByRole("dialog")).toBeNull();
        expect(approveOperationsCatdbSearches).not.toHaveBeenCalled();
        expect(await screen.findByRole("status", { name: "Last catalytic analysis" })).toHaveTextContent("CatDB VIN: nothing new to search (200 already searched");
    });

    it("CatDB VIN alone: confirmation, then only the approval, no free run", async () => {
        await open();
        tick("Our Database");
        tick("CatDB Local");
        tick("CatDB VIN");
        fireEvent.click(await runButton());
        const dialog = await screen.findByRole("dialog");
        expect(within(dialog).queryByRole("button", { name: "Run free sources only" })).toBeNull();
        fireEvent.click(within(dialog).getByRole("checkbox"));
        fireEvent.click(within(dialog).getByRole("button", { name: /Approve/ }));
        await waitFor(() => expect(approveOperationsCatdbSearches).toHaveBeenCalled());
        expect(runOperationsCatalyticAnalysis).not.toHaveBeenCalled();
    });

    it("the paused state is stated in the confirmation", async () => {
        getOperationsCatalytic.mockResolvedValue(overview({ global_paused: true }));
        await open();
        tick("CatDB VIN");
        fireEvent.click(await runButton());
        expect(await screen.findByRole("dialog")).toHaveTextContent("CatDB is paused, so approved searches wait until it is resumed");
    });

    it("scopes keep their meaning: missing results is the whole batch for paid, selected sends the ids", async () => {
        await open({ selectedVehicleIds: [4, 9] });
        tick("CatDB VIN");
        fireEvent.change(screen.getByLabelText("Scope"), { target: { value: "MISSING" } });
        fireEvent.click(await runButton());
        await screen.findByRole("dialog");
        expect(previewOperationsCatdbSearches).toHaveBeenLastCalledWith(7, { scope: "ALL", vehicleIds: undefined });
        fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
        fireEvent.change(screen.getByLabelText("Scope"), { target: { value: "SELECTED" } });
        fireEvent.click(await runButton());
        await screen.findByRole("dialog");
        expect(previewOperationsCatdbSearches).toHaveBeenLastCalledWith(7, { scope: "SELECTED", vehicleIds: [4, 9] });
    });

    it("an empty selection keeps Run off, with the reason", async () => {
        await open();
        fireEvent.change(screen.getByLabelText("Scope"), { target: { value: "SELECTED" } });
        expect(await screen.findByText("Select vehicles in the table first.")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Run Catalytic Analysis" })).toBeDisabled();
    });

    it("with no source ticked, Run is off", async () => {
        await open();
        tick("Our Database");
        tick("CatDB Local");
        expect(await screen.findByText("Tick at least one source.")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Run Catalytic Analysis" })).toBeDisabled();
    });

    it("cancel remaining appears only with work out, confirms first, and is this batch's only", async () => {
        getOperationsCatalytic.mockResolvedValue(overview({ active_job_count: 0 }));
        await open();
        expect(screen.queryByRole("button", { name: /Cancel remaining/ })).toBeNull();
        getOperationsCatalytic.mockResolvedValue(overview({
            active_job_count: 5,
            sources: [source("OUR_DATABASE", true, "PARTIAL"), source("CATDB_VIN", true, "QUEUED", { counts: { QUEUED: 5, DONE: 3 } }), source("CATDB_LOCAL", true, "COMPLETED"), source("ECOTRADE_LOCAL", false, "NOT_REQUESTED")],
        }));
        cancelOperationsCatalyticRemaining.mockResolvedValue({ cancelled_job_ids: [1, 2, 3, 4], search_already_submitted_job_ids: [5] });
        render(<CatalyticProcessingCard batchId={7} refreshKey={1} onChanged={vi.fn()} />);
        fireEvent.click((await screen.findAllByRole("button", { name: /Catalytic Processing/ })).at(-1));
        expect(await screen.findByText(/5 waiting · 3 searched/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Cancel remaining (5)" }));
        const dialog = screen.getByRole("dialog");
        expect(dialog).toHaveTextContent("Other batches and CatDB itself aren't affected");
        expect(cancelOperationsCatalyticRemaining).not.toHaveBeenCalled();
        fireEvent.click(within(dialog).getByRole("button", { name: "Cancel remaining" }));
        await waitFor(() => expect(cancelOperationsCatalyticRemaining).toHaveBeenCalledWith(7));
    });

    it("paid search history opens on request", async () => {
        getOperationsCatalytic.mockResolvedValue(overview({ sources: [source("OUR_DATABASE", true), source("CATDB_VIN", true, "COMPLETED", { counts: { DONE: 3 } }), source("CATDB_LOCAL", true), source("ECOTRADE_LOCAL", false, "NOT_REQUESTED")] }));
        await open();
        expect(screen.queryByTestId("paid-history")).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "Paid search history" }));
        expect(screen.getByTestId("paid-history")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "CatDB Automation" })).toHaveAttribute("href", "/cats/admin/catdb");
    });

    it("says which setting decides Recovery Total", async () => {
        await open();
        fireEvent.click(screen.getByRole("button", { name: "About search sources" }));
        expect(screen.getByRole("tooltip")).toHaveTextContent("Recovery Settings → Catalytic price priority");
    });
});
