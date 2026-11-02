import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CatalyticProcessingCard from "../CatalyticProcessingCard";
import {
    cancelOperationsCatalyticRemaining,
    getOperationsCatalytic,
    runOperationsLocalSearch,
    runOperationsOurDatabaseSearch,
    saveOperationsCatalyticSources,
} from "@/lib/operations/api";
import { pauseProcessing, stopWorker } from "@/lib/catalytic/catdbAdmin";

vi.mock("@/lib/operations/api", () => ({
    cancelOperationsCatalyticRemaining: vi.fn(),
    getOperationsCatalytic: vi.fn(),
    runOperationsLocalSearch: vi.fn(),
    runOperationsOurDatabaseSearch: vi.fn(),
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

const PAUSED = "CatDB processing is globally paused. Resume processing in CatDB administration before starting paid searches.";

function overview(overrides = {}) {
    return {
        operations_batch_id: 7,
        total_vehicles: 10,
        sources: [
            { source: "CATDB_VIN", selected: false, status: "NOT_REQUESTED", counts: {} },
            { source: "CATDB_LOCAL", selected: true, status: "READY", counts: {} },
            { source: "ECOTRADE_LOCAL", selected: false, status: "NOT_REQUESTED", counts: {} },
        ],
        global_paused: false,
        workers: [{ id: 8, name: "phone", stop_state: "NONE" }],
        paid_block_reason: null,
        active_job_count: 0,
        scope_counts: { ALL: 10, NO_LOCAL_MATCH: 4, FAILED: 1, PAID_FAILED: 0 },
        ...overrides,
    };
}

describe("CatalyticProcessingCard", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getOperationsCatalytic.mockResolvedValue(overview());
        runOperationsLocalSearch.mockResolvedValue({ vehicles_searched: 10, sources: [] });
    });

    it("shows a valid status per source, and no source is an error", async () => {
        getOperationsCatalytic.mockResolvedValue(overview({
            sources: [
                { source: "CATDB_VIN", selected: false, status: "NOT_REQUESTED", counts: {} },
                { source: "CATDB_LOCAL", selected: true, status: "COMPLETED", counts: {} },
                { source: "ECOTRADE_LOCAL", selected: true, status: "COMPLETED", counts: {} },
            ],
        }));
        render(<CatalyticProcessingCard batchId={7} />);
        expect(await screen.findByText("Not requested")).toBeInTheDocument();
        expect(screen.getAllByText("Completed")).toHaveLength(2);
    });

    it("saving sources sends all three and starts nothing", async () => {
        saveOperationsCatalyticSources.mockResolvedValue(overview());
        render(<CatalyticProcessingCard batchId={7} />);
        fireEvent.click(await screen.findByLabelText(/ecotrade local database/i));
        fireEvent.click(screen.getByRole("button", { name: "Save Sources" }));
        await waitFor(() => expect(saveOperationsCatalyticSources).toHaveBeenCalledWith(7, {
            run_catdb: false, run_catdb_local: true, run_ecotrade_local: true,
        }));
        expect(runOperationsLocalSearch).not.toHaveBeenCalled();
    });

    it("runs a local search only when asked, with the affected count on the button", async () => {
        render(<CatalyticProcessingCard batchId={7} />);
        const run = await screen.findByRole("button", { name: "Run Local Search (10)" });
        expect(runOperationsLocalSearch).not.toHaveBeenCalled();
        fireEvent.click(run);
        await waitFor(() => expect(runOperationsLocalSearch).toHaveBeenCalledWith(7, { scope: "ALL", vehicleIds: undefined }));
    });

    it("processes only the selected vehicles", async () => {
        render(<CatalyticProcessingCard batchId={7} selectedVehicleIds={[3, 4]} />);
        fireEvent.change(await screen.findByLabelText("Process"), { target: { value: "SELECTED" } });
        fireEvent.click(screen.getByRole("button", { name: "Run Local Search (2)" }));
        await waitFor(() => expect(runOperationsLocalSearch).toHaveBeenCalledWith(7, { scope: "SELECTED", vehicleIds: [3, 4] }));
    });

    it("cannot run with an empty selection or unsaved or missing local sources", async () => {
        render(<CatalyticProcessingCard batchId={7} />);
        fireEvent.change(await screen.findByLabelText("Process"), { target: { value: "SELECTED" } });
        expect(screen.getByRole("button", { name: "Run Local Search (0)" })).toBeDisabled();
        fireEvent.change(screen.getByLabelText("Process"), { target: { value: "ALL" } });
        fireEvent.click(screen.getByLabelText(/ecotrade local database/i));
        expect(screen.getByRole("button", { name: "Run Local Search (10)" })).toBeDisabled();
    });

    it("hides paid searches until the source is saved, then passes the hold along", async () => {
        const { unmount } = render(<CatalyticProcessingCard batchId={7} />);
        await screen.findByText("Catalytic Processing");
        expect(screen.queryByTestId("paid")).toBeNull();
        unmount();

        getOperationsCatalytic.mockResolvedValue(overview({
            global_paused: true,
            paid_block_reason: PAUSED,
            sources: [{ source: "CATDB_VIN", selected: true, status: "READY", counts: {} }, ...overview().sources.slice(1)],
        }));
        render(<CatalyticProcessingCard batchId={7} />);
        expect(await screen.findByText(new RegExp("CatDB processing is globally paused"))).toBeInTheDocument();
        expect(screen.getByTestId("paid")).toHaveAttribute("data-block", PAUSED);
        expect(screen.getByRole("link", { name: /catdb administration/i })).toHaveAttribute("href", "/cats/admin/catdb");
    });

    it("offers no way to resume or clear a stop, and shows the held state", async () => {
        getOperationsCatalytic.mockResolvedValue(overview({
            global_paused: true,
            paid_block_reason: PAUSED,
            workers: [{ id: 8, name: "phone", stop_state: "WORKER_STOPPED" }],
        }));
        render(<CatalyticProcessingCard batchId={7} />);
        expect(await screen.findByRole("button", { name: "Paused" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Stopped" })).toBeDisabled();
        expect(screen.queryByRole("button", { name: /resume/i })).toBeNull();
        expect(screen.queryByRole("button", { name: /clear/i })).toBeNull();
    });

    it("pause and stop confirm first and say they apply to all batches", async () => {
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

    describe("Our Database", () => {
        const withOurDatabase = (selected, status = "NOT_STARTED", extra = {}) => overview({
            sources: [
                { source: "OUR_DATABASE", selected, status, counts: {} },
                { source: "CATDB_VIN", selected: true, status: "READY", counts: {} },
                { source: "CATDB_LOCAL", selected: false, status: "NOT_REQUESTED", counts: {} },
                { source: "ECOTRADE_LOCAL", selected: false, status: "NOT_REQUESTED", counts: {} },
            ],
            scope_counts: { ALL: 10, NO_LOCAL_MATCH: 4, FAILED: 0, PAID_FAILED: 0, OURDB_ALL: 8, OURDB_NO_LOCAL_MATCH: 3, OURDB_FAILED: 2 },
            ...extra,
        });

        beforeEach(() => {
            runOperationsOurDatabaseSearch.mockResolvedValue({ vehicles_in_scope: 10, started: 8, skipped: 2 });
        });

        it("lists it first, keeping a saved unselected state", async () => {
            getOperationsCatalytic.mockResolvedValue(withOurDatabase(false));
            render(<CatalyticProcessingCard batchId={7} />);
            const box = await screen.findByLabelText(/^our database/i);
            expect(box).not.toBeChecked();
            expect(screen.getAllByRole("checkbox")[0]).toBe(box);
            expect(screen.getByRole("button", { name: "Run Our Database (8)" })).toBeDisabled();
        });

        it.each([
            ["NOT_STARTED", "Not Started"],
            ["PROCESSING", "Processing"],
            ["COMPLETE", "Complete"],
            ["PARTIAL", "Partial"],
            ["FAILED", "Failed"],
        ])("shows status %s", async (status, label) => {
            getOperationsCatalytic.mockResolvedValue(withOurDatabase(true, status));
            render(<CatalyticProcessingCard batchId={7} />);
            expect(await screen.findByText(label)).toBeInTheDocument();
        });

        it("saving sends the choice and runs nothing", async () => {
            getOperationsCatalytic.mockResolvedValue(withOurDatabase(false));
            saveOperationsCatalyticSources.mockResolvedValue(withOurDatabase(true));
            render(<CatalyticProcessingCard batchId={7} />);
            fireEvent.click(await screen.findByLabelText(/^our database/i));
            expect(screen.getByRole("button", { name: "Run Our Database (8)" })).toBeDisabled();
            fireEvent.click(screen.getByRole("button", { name: "Save Sources" }));
            await waitFor(() => expect(saveOperationsCatalyticSources).toHaveBeenCalledWith(7, {
                run_ourdb: true, run_catdb: true, run_catdb_local: false, run_ecotrade_local: false,
            }));
            expect(runOperationsOurDatabaseSearch).not.toHaveBeenCalled();
            expect(runOperationsLocalSearch).not.toHaveBeenCalled();
        });

        it("runs all vehicles only when asked, and calls nothing else", async () => {
            getOperationsCatalytic.mockResolvedValue(withOurDatabase(true));
            render(<CatalyticProcessingCard batchId={7} />);
            const run = await screen.findByRole("button", { name: "Run Our Database (8)" });
            expect(runOperationsOurDatabaseSearch).not.toHaveBeenCalled();
            fireEvent.click(run);
            await waitFor(() => expect(runOperationsOurDatabaseSearch).toHaveBeenCalledWith(7, { scope: "ALL", vehicleIds: undefined }));
            expect(runOperationsLocalSearch).not.toHaveBeenCalled();
            expect(pauseProcessing).not.toHaveBeenCalled();
        });

        it("uses the shared scope selector", async () => {
            getOperationsCatalytic.mockResolvedValue(withOurDatabase(true));
            render(<CatalyticProcessingCard batchId={7} selectedVehicleIds={[3, 4]} />);
            fireEvent.change(await screen.findByLabelText("Process"), { target: { value: "SELECTED" } });
            fireEvent.click(screen.getByRole("button", { name: "Run Our Database (2)" }));
            await waitFor(() => expect(runOperationsOurDatabaseSearch).toHaveBeenCalledWith(7, { scope: "SELECTED", vehicleIds: [3, 4] }));
        });

        it("counts its own failures for a retry", async () => {
            getOperationsCatalytic.mockResolvedValue(withOurDatabase(true));
            render(<CatalyticProcessingCard batchId={7} />);
            fireEvent.change(await screen.findByLabelText("Process"), { target: { value: "FAILED" } });
            expect(screen.getByRole("button", { name: "Run Our Database (2)" })).toBeEnabled();
        });

        it("can't start again while running, or with nothing left to search", async () => {
            getOperationsCatalytic.mockResolvedValue(withOurDatabase(true, "PROCESSING"));
            const { unmount } = render(<CatalyticProcessingCard batchId={7} />);
            expect(await screen.findByRole("button", { name: "Run Our Database (8)" })).toBeDisabled();
            unmount();

            const done = withOurDatabase(true, "COMPLETE");
            done.scope_counts.OURDB_ALL = 0;
            getOperationsCatalytic.mockResolvedValue(done);
            render(<CatalyticProcessingCard batchId={7} />);
            expect(await screen.findByRole("button", { name: "Run Our Database (0)" })).toBeDisabled();
        });

        it("leaves pause, stop and the paid section as they are", async () => {
            getOperationsCatalytic.mockResolvedValue(withOurDatabase(true, "NOT_STARTED", { global_paused: true, paid_block_reason: PAUSED }));
            render(<CatalyticProcessingCard batchId={7} />);
            expect(await screen.findByRole("button", { name: "Paused" })).toBeDisabled();
            expect(screen.getByTestId("paid").dataset.block).toBe(PAUSED);
            expect(screen.getByRole("button", { name: "Run Our Database (8)" })).toBeEnabled();
        });
    });
});
