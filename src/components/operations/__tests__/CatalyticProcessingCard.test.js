import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CatalyticProcessingCard from "../CatalyticProcessingCard";
import {
    cancelOperationsCatalyticRemaining,
    getOperationsCatalytic,
    planOperationsCatalytic,
    runOperationsCatalyticAnalysis,
    saveOperationsCatalyticSources,
} from "@/lib/operations/api";
import { pauseProcessing, stopWorker } from "@/lib/catalytic/catdbAdmin";
import toast from "react-hot-toast";

vi.mock("@/lib/operations/api", () => ({
    cancelOperationsCatalyticRemaining: vi.fn(),
    getOperationsCatalytic: vi.fn(),
    planOperationsCatalytic: vi.fn(),
    runOperationsCatalyticAnalysis: vi.fn(),
    saveOperationsCatalyticSources: vi.fn(),
}));
vi.mock("@/lib/catalytic/catdbAdmin", () => ({
    pauseProcessing: vi.fn(),
    stopWorker: vi.fn(),
    cancelAllPending: vi.fn(),
    clearWorkerStop: vi.fn(),
    getControlStatus: vi.fn(),
    resumeProcessing: vi.fn(),
}));
vi.mock("../CatdbSection", () => ({ default: (props) => <div data-testid="paid" data-block={props.blockReason || ""} data-scope={props.scope} data-count={props.scopeCount} /> }));
vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn() } }));

// Phase K.49 — one Run Catalytic Analysis over the ticked free sources.

const PAUSED = "CatDB processing is globally paused. Resume processing in CatDB administration before starting paid searches.";

const source = (name, selected, status = "READY", extra = {}) => ({ source: name, selected, status, counts: {}, priced: 0, ...extra });

function overview(overrides = {}) {
    return {
        operations_batch_id: 7,
        total_vehicles: 357,
        sources: [
            source("OUR_DATABASE", true, "PARTIAL"),
            source("CATDB_VIN", false, "NOT_REQUESTED"),
            source("CATDB_LOCAL", true, "COMPLETED", { priced: 41 }),
            source("ECOTRADE_LOCAL", true, "COMPLETED", { priced: 252 }),
        ],
        global_paused: true,
        workers: [{ id: 8, name: "phone", stop_state: "WORKER_STOPPED" }],
        paid_block_reason: PAUSED,
        active_job_count: 0,
        scope_counts: { ALL: 357, NO_LOCAL_MATCH: 100, FAILED: 3, PAID_FAILED: 0 },
        ...overrides,
    };
}

// Counts like the server: the ticked free sources, per scope.
function servePlan() {
    planOperationsCatalytic.mockImplementation(async (_batchId, { sources, scope, vehicleIds }) => {
        const free = sources.filter((s) => s !== "CATDB_VIN");
        const inScope = scope === "SELECTED" ? vehicleIds.length : 357;
        const perSource = { OUR_DATABASE: scope === "FAILED" ? 3 : 357, CATDB_LOCAL: scope === "MISSING" ? 316 : inScope, ECOTRADE_LOCAL: scope === "MISSING" ? 105 : inScope };
        const planned = free.map((s) => ({
            source: s, to_process: Math.min(perSource[s], inScope), in_progress: 0,
            with_result: { OUR_DATABASE: 354, CATDB_LOCAL: 357, ECOTRADE_LOCAL: 357 }[s], priced: { OUR_DATABASE: 0, CATDB_LOCAL: 41, ECOTRADE_LOCAL: 252 }[s],
        }));
        const toProcess = planned.length ? Math.max(...planned.map((p) => p.to_process)) : 0;
        return {
            scope, vehicles_in_scope: inScope, vehicles_to_process: toProcess, sources: planned,
            paid: { selected: sources.includes("CATDB_VIN"), runs_here: false, available: false, reason: PAUSED },
            blocked_reason: !free.length ? "Select at least one source." : toProcess ? null : "Every vehicle in this scope already has a result from the selected sources.",
        };
    });
}

// Enabled only once the server has counted the vehicles.
const runButton = async () => {
    const button = await screen.findByRole("button", { name: /^Run Catalytic Analysis/ });
    await waitFor(() => expect(button).toBeEnabled());
    return button;
};

beforeEach(() => {
    vi.clearAllMocks();
    getOperationsCatalytic.mockResolvedValue(overview());
    servePlan();
    runOperationsCatalyticAnalysis.mockResolvedValue({
        scope: "ALL", vehicles_in_scope: 357, vehicles_to_process: 357,
        sources: [
            { source: "OUR_DATABASE", state: "STARTED", vehicles: 357, matched: 0, no_match: 0, failed: 0, kept_existing: 0 },
            { source: "CATDB_LOCAL", state: "COMPLETED", vehicles: 357, matched: 41, no_match: 314, failed: 0, kept_existing: 2 },
            { source: "ECOTRADE_LOCAL", state: "COMPLETED", vehicles: 357, matched: 252, no_match: 105, failed: 0, kept_existing: 0 },
        ],
        paid: { selected: false, runs_here: false, available: false, reason: PAUSED },
    });
});

describe("Run Catalytic Analysis", () => {
    it("replaces the old buttons with one action that says how many vehicles it covers", async () => {
        render(<CatalyticProcessingCard batchId={7} />);
        expect(await screen.findByRole("button", { name: "Run Catalytic Analysis (357 vehicles)" })).toBeEnabled();
        expect(screen.queryByRole("button", { name: /Run Our Database|Run Local Search/ })).toBeNull();
        expect(screen.getByText(/357 vehicles in the batch · 357 in this scope/)).toBeInTheDocument();
        expect(screen.getByText("CatDB Local: 357 to look up · 357 already looked up, 41 priced")).toBeInTheDocument();
        expect(screen.getByText("41 priced")).toBeInTheDocument();
    });

    it("runs exactly the ticked sources, saving them, and nothing runs until clicked", async () => {
        render(<CatalyticProcessingCard batchId={7} />);
        fireEvent.click(await screen.findByLabelText(/^catdb local database/i));
        await waitFor(() => expect(planOperationsCatalytic).toHaveBeenLastCalledWith(7, expect.objectContaining({ sources: ["ECOTRADE_LOCAL", "OUR_DATABASE"] })));
        expect(runOperationsCatalyticAnalysis).not.toHaveBeenCalled();
        fireEvent.click(await runButton());
        await waitFor(() => expect(runOperationsCatalyticAnalysis).toHaveBeenCalledWith(7, { sources: ["ECOTRADE_LOCAL", "OUR_DATABASE"], scope: "ALL", vehicleIds: undefined }));
        expect(saveOperationsCatalyticSources).not.toHaveBeenCalled();
        expect(pauseProcessing).not.toHaveBeenCalled();
    });

    it.each([
        [["OUR_DATABASE"], "Our Database"],
        [["CATDB_LOCAL"], "CatDB Local"],
        [["ECOTRADE_LOCAL"], "EcoTrade Local"],
    ])("can run a single source: %s", async (only) => {
        getOperationsCatalytic.mockResolvedValue(overview({
            sources: overview().sources.map((s) => ({ ...s, selected: only.includes(s.source) })),
        }));
        render(<CatalyticProcessingCard batchId={7} />);
        fireEvent.click(await runButton());
        await waitFor(() => expect(runOperationsCatalyticAnalysis).toHaveBeenCalledWith(7, expect.objectContaining({ sources: only })));
    });

    it("with no source ticked the button is off and says why", async () => {
        getOperationsCatalytic.mockResolvedValue(overview({ sources: overview().sources.map((s) => ({ ...s, selected: false })) }));
        render(<CatalyticProcessingCard batchId={7} />);
        expect(await screen.findByRole("button", { name: "Run Catalytic Analysis (0 vehicles)" })).toBeDisabled();
        expect(screen.getByText("Tick at least one source.")).toBeInTheDocument();
    });

    it("CatDB VIN alone can't run here, and a paused paid search is explained, never started", async () => {
        getOperationsCatalytic.mockResolvedValue(overview({
            sources: overview().sources.map((s) => ({ ...s, selected: s.source === "CATDB_VIN" })),
        }));
        render(<CatalyticProcessingCard batchId={7} />);
        expect(await screen.findByText(/CatDB VIN Search is paid and runs only through its own approval below/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /^Run Catalytic Analysis/ })).toBeDisabled();
        expect(screen.getByTestId("paid")).toHaveAttribute("data-block", PAUSED);
        expect(runOperationsCatalyticAnalysis).not.toHaveBeenCalled();
    });

    it("free sources still run with CatDB VIN ticked, and the page says paid isn't included", async () => {
        render(<CatalyticProcessingCard batchId={7} />);
        fireEvent.click(await screen.findByLabelText(/^catdb vin search/i));
        expect(await screen.findByText(/CatDB VIN Search is paid, so this run doesn't include it: CatDB processing is globally paused/)).toBeInTheDocument();
        fireEvent.click(await runButton());
        await waitFor(() => expect(runOperationsCatalyticAnalysis).toHaveBeenCalledWith(7, expect.objectContaining({
            sources: expect.arrayContaining(["CATDB_VIN", "OUR_DATABASE", "CATDB_LOCAL", "ECOTRADE_LOCAL"]),
        })));
    });

    it("counts only what a scope needs: missing results, failed lookups, selected vehicles", async () => {
        render(<CatalyticProcessingCard batchId={7} selectedVehicleIds={[3, 4]} />);
        await runButton();
        fireEvent.change(screen.getByLabelText("Process"), { target: { value: "MISSING" } });
        expect(await screen.findByText("CatDB Local: 316 to look up · 357 already looked up, 41 priced")).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText("Process"), { target: { value: "FAILED" } });
        expect(await screen.findByText("Our Database: 3 to look up · 354 already looked up, 0 priced")).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText("Process"), { target: { value: "SELECTED" } });
        expect(await screen.findByRole("button", { name: "Run Catalytic Analysis (2 vehicles)" })).toBeEnabled();
        fireEvent.click(screen.getByRole("button", { name: "Run Catalytic Analysis (2 vehicles)" }));
        await waitFor(() => expect(runOperationsCatalyticAnalysis).toHaveBeenCalledWith(7, expect.objectContaining({ scope: "SELECTED", vehicleIds: [3, 4] })));
    });

    it("an empty selection and an already processed scope keep the button off, with the reason", async () => {
        planOperationsCatalytic.mockResolvedValue({
            scope: "MISSING", vehicles_in_scope: 357, vehicles_to_process: 0, sources: [], paid: null,
            blocked_reason: "Every vehicle in this scope already has a result from the selected sources.",
        });
        render(<CatalyticProcessingCard batchId={7} />);
        expect(await screen.findByText("Every vehicle in this scope already has a result from the selected sources.")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Run Catalytic Analysis (0 vehicles)" })).toBeDisabled();
        fireEvent.change(screen.getByLabelText("Process"), { target: { value: "SELECTED" } });
        expect(await screen.findByText("Select vehicles in the table first.")).toBeInTheDocument();
    });

    it("reports what each source really did, and Our Database's progress", async () => {
        getOperationsCatalytic.mockResolvedValueOnce(overview()).mockResolvedValue(overview({
            sources: [source("OUR_DATABASE", true, "PROCESSING", { counts: { QUEUED: 200, DONE: 157 } }), ...overview().sources.slice(1)],
        }));
        render(<CatalyticProcessingCard batchId={7} />);
        fireEvent.click(await runButton());
        const report = await screen.findByRole("status", { name: "Last catalytic analysis" });
        expect(within(report).getByText("CatDB Local: looked up 357 vehicles · 41 matched · 314 no match · 0 failed · 2 kept their stored price")).toBeInTheDocument();
        expect(within(report).getByText("Our Database: looking up 357 vehicles in the background")).toBeInTheDocument();
        expect(await within(report).findByText(/Our Database is running: 0 priced in this batch · 0 failed · 200 still to look up/)).toBeInTheDocument();
        expect(toast.success).toHaveBeenCalled();
    });

    it("never claims success when nothing was looked up", async () => {
        runOperationsCatalyticAnalysis.mockResolvedValue({
            scope: "ALL", vehicles_in_scope: 357, vehicles_to_process: 0,
            sources: [{ source: "OUR_DATABASE", state: "ALREADY_RUNNING", vehicles: 0 }],
            paid: { selected: false, runs_here: false, available: false, reason: PAUSED },
        });
        render(<CatalyticProcessingCard batchId={7} />);
        fireEvent.click(await runButton());
        expect(await screen.findByText("Our Database: already running for this batch, nothing new started")).toBeInTheDocument();
        expect(toast.success).not.toHaveBeenCalled();
        expect(toast.error).toHaveBeenCalledWith("Nothing was looked up: every source had nothing to do.");
    });

    it("a refused run shows the server's reason", async () => {
        const { CatalyticApiError } = await import("@/lib/catalytic/http");
        runOperationsCatalyticAnalysis.mockRejectedValue(new CatalyticApiError("Select at least one source.", { status: 400 }));
        render(<CatalyticProcessingCard batchId={7} />);
        fireEvent.click(await runButton());
        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Select at least one source."));
    });
});

describe("sources and the paid controls", () => {
    it("saving sources sends all four and starts nothing", async () => {
        saveOperationsCatalyticSources.mockResolvedValue(overview());
        render(<CatalyticProcessingCard batchId={7} />);
        fireEvent.click(await screen.findByLabelText(/ecotrade local database/i));
        fireEvent.click(screen.getByRole("button", { name: "Save Sources" }));
        await waitFor(() => expect(saveOperationsCatalyticSources).toHaveBeenCalledWith(7, {
            run_ourdb: true, run_catdb: false, run_catdb_local: true, run_ecotrade_local: false,
        }));
        expect(runOperationsCatalyticAnalysis).not.toHaveBeenCalled();
    });

    it.each([["PROCESSING", "Processing"], ["PARTIAL", "Partial"], ["FAILED", "Failed"]])("shows Our Database status %s", async (status, label) => {
        getOperationsCatalytic.mockResolvedValue(overview({ sources: [source("OUR_DATABASE", true, status), ...overview().sources.slice(1)] }));
        render(<CatalyticProcessingCard batchId={7} />);
        expect(await screen.findByText(label)).toBeInTheDocument();
    });

    it("hides paid searches until the source is saved, then passes the hold along", async () => {
        const { unmount } = render(<CatalyticProcessingCard batchId={7} />);
        await screen.findByText("Catalytic Processing");
        expect(screen.queryByTestId("paid")).toBeNull();
        unmount();
        getOperationsCatalytic.mockResolvedValue(overview({ sources: overview().sources.map((s) => (s.source === "CATDB_VIN" ? { ...s, selected: true } : s)) }));
        render(<CatalyticProcessingCard batchId={7} />);
        expect(await screen.findByTestId("paid")).toHaveAttribute("data-block", PAUSED);
        expect(screen.getByRole("link", { name: /catdb administration/i })).toHaveAttribute("href", "/cats/admin/catdb");
    });

    it("the paid preview gets a scope it understands", async () => {
        getOperationsCatalytic.mockResolvedValue(overview({ sources: overview().sources.map((s) => (s.source === "CATDB_VIN" ? { ...s, selected: true } : s)) }));
        render(<CatalyticProcessingCard batchId={7} />);
        await screen.findByTestId("paid");
        fireEvent.change(screen.getByLabelText("Process"), { target: { value: "MISSING" } });
        expect(screen.getByTestId("paid")).toHaveAttribute("data-scope", "ALL");
        expect(screen.getByTestId("paid")).toHaveAttribute("data-count", "357");
    });

    it("offers no way to resume or clear a stop, and shows the held state", async () => {
        render(<CatalyticProcessingCard batchId={7} />);
        expect(await screen.findByRole("button", { name: "Paused" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Stopped" })).toBeDisabled();
        expect(screen.queryByRole("button", { name: /resume/i })).toBeNull();
        expect(screen.queryByRole("button", { name: /clear/i })).toBeNull();
    });

    it("pause and stop confirm first and say they apply to all batches", async () => {
        getOperationsCatalytic.mockResolvedValue(overview({ global_paused: false, paid_block_reason: null, workers: [{ id: 8, name: "phone", stop_state: "NONE" }] }));
        pauseProcessing.mockResolvedValue({});
        stopWorker.mockResolvedValue({});
        render(<CatalyticProcessingCard batchId={7} />);
        fireEvent.click(await screen.findByRole("button", { name: "Pause" }));
        const dialog = screen.getByRole("dialog");
        expect(pauseProcessing).not.toHaveBeenCalled();
        expect(within(dialog).getByText(/for all batches/i)).toBeInTheDocument();
        fireEvent.click(within(dialog).getByRole("button", { name: "Pause" }));
        await waitFor(() => expect(pauseProcessing).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
        fireEvent.click(screen.getByRole("button", { name: "Stop" }));
        fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Send stop request" }));
        await waitFor(() => expect(stopWorker).toHaveBeenCalledWith(8));
    });

    it("cancel remaining confirms, is scoped to the batch, and is off with nothing to cancel", async () => {
        cancelOperationsCatalyticRemaining.mockResolvedValue({ cancelled_job_ids: [1], search_already_submitted_job_ids: [], shared_with_other_batch_job_ids: [] });
        const { unmount } = render(<CatalyticProcessingCard batchId={7} />);
        expect(await screen.findByRole("button", { name: "Cancel Remaining (0)" })).toBeDisabled();
        unmount();
        getOperationsCatalytic.mockResolvedValue(overview({ active_job_count: 3 }));
        render(<CatalyticProcessingCard batchId={7} />);
        fireEvent.click(await screen.findByRole("button", { name: "Cancel Remaining (3)" }));
        expect(cancelOperationsCatalyticRemaining).not.toHaveBeenCalled();
        fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel remaining" }));
        await waitFor(() => expect(cancelOperationsCatalyticRemaining).toHaveBeenCalledWith(7));
    });
});
