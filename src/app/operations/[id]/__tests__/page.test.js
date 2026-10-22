import { render, screen, waitFor, cleanup, act, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import OperationsBatchDetailPage from "../page";
import { getOperationsBatch, getOperationsBatchProgress } from "@/lib/operations/api";
import { CatalyticApiError } from "@/lib/catalytic/http";

vi.mock("next/navigation", () => ({
    useParams: () => ({ id: "7" }),
    useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/operations/api", () => ({
    getOperationsBatch: vi.fn(),
    getOperationsBatchProgress: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
    default: { success: vi.fn(), error: vi.fn() },
}));

// Isolate the page's own polling/loading/error behavior from the heavy
// child components (each has its own dedicated test file already).
// ProcessingProgress/FinancialSummaryCards/VehicleTable render the
// refreshKey they were given so tests can prove it actually advances on
// every tick — including the final one that detects completion, which
// is exactly the Phase K.9 regression (results previously only appeared
// after a full page reload because that last tick never bumped it).
vi.mock("@/components/operations/FinancialSummaryCards", () => ({
    default: (props) => <div data-testid="financial-summary">{props.refreshKey}</div>,
}));
vi.mock("@/components/operations/ProcessingProgress", () => ({
    default: (props) => <div data-testid="processing-progress">{props.refreshKey}</div>,
}));
vi.mock("@/components/operations/VehicleTable", () => ({
    default: (props) => <div data-testid="vehicle-table">{props.refreshKey}</div>,
}));
vi.mock("@/components/operations/ExportCsvButton", () => ({ default: () => <div data-testid="export-csv-button" /> }));
vi.mock("@/components/operations/CatdbSection", () => ({ default: () => <div data-testid="catdb-section" /> }));
vi.mock("@/components/operations/VehicleDetailModal", () => ({ default: () => null }));
// A minimal stand-in for the real ProcessingControls — exposes a single
// button per leg that calls onBatchUpdated exactly like the real
// component's Start button does (including the leg key, see
// ProcessingControls.js's own run()), so page-level tests can simulate
// "the user clicked Start" without needing the real component's own
// (separately tested) internals.
vi.mock("@/components/operations/ProcessingControls", () => ({
    default: ({ onBatchUpdated }) => (
        <div data-testid="processing-controls">
            <button onClick={() => onBatchUpdated({ id: 7, status: "PROCESSING" }, "parts")}>start-parts</button>
            <button onClick={() => onBatchUpdated({ id: 7, status: "PROCESSING" }, "ourdb")}>start-ourdb</button>
        </div>
    ),
}));

function doneBatch(overrides = {}) {
    return { id: 7, status: "DONE", total_vehicles: 7, created_at: "2026-01-01T00:00:00", error_message: "", ...overrides };
}

function leg(overrides = {}) {
    return {
        total: 7, not_requested_count: 0, queued_count: 0, processing_count: 0,
        done_count: 0, failed_count: 0, no_data_count: 0, ...overrides,
    };
}

const ALL_IDLE = { parts: leg({ done_count: 7 }), ourdb: leg({ not_requested_count: 7 }), weight: leg({ not_requested_count: 7 }) };

describe("OperationsBatchDetailPage", () => {
    beforeEach(() => {
        getOperationsBatch.mockReset();
        getOperationsBatchProgress.mockReset();
        getOperationsBatchProgress.mockResolvedValue(ALL_IDLE);
    });

    afterEach(() => {
        cleanup();
        vi.useRealTimers();
    });

    it("renders the batch header and child sections once loaded", async () => {
        getOperationsBatch.mockResolvedValue(doneBatch());
        render(<OperationsBatchDetailPage />);

        expect(await screen.findByText("Batch #7")).toBeInTheDocument();
        expect(screen.getByTestId("processing-controls")).toBeInTheDocument();
        expect(screen.getByTestId("financial-summary")).toBeInTheDocument();
        expect(screen.getByTestId("processing-progress")).toBeInTheDocument();
        expect(screen.getByTestId("export-csv-button")).toBeInTheDocument();
        expect(screen.getByTestId("catdb-section")).toBeInTheDocument();
        expect(screen.getByTestId("vehicle-table")).toBeInTheDocument();
    });

    it("shows a retryable error state on a failed load", async () => {
        getOperationsBatch.mockRejectedValue(new CatalyticApiError("Failed to load batch", { status: 404 }));
        render(<OperationsBatchDetailPage />);
        expect(await screen.findByText(/failed to load batch/i)).toBeInTheDocument();
    });

    it("never polls at all when every leg is already terminal on load", async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        getOperationsBatch.mockResolvedValue(doneBatch());

        render(<OperationsBatchDetailPage />);
        await waitFor(() => expect(getOperationsBatchProgress).toHaveBeenCalledTimes(1));

        await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
        expect(getOperationsBatchProgress).toHaveBeenCalledTimes(1);
    });

    it("stops polling on unmount and never fires a request against a torn-down component", async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        getOperationsBatch.mockResolvedValue(doneBatch({ status: "PROCESSING" }));
        getOperationsBatchProgress.mockResolvedValue({ ...ALL_IDLE, parts: leg({ processing_count: 7 }) });

        const { unmount } = render(<OperationsBatchDetailPage />);
        await waitFor(() => expect(getOperationsBatchProgress).toHaveBeenCalledTimes(1));

        unmount();
        getOperationsBatchProgress.mockClear();

        await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
        expect(getOperationsBatchProgress).not.toHaveBeenCalled();
    });

    // ─── Phase K.9: the actual regression this phase fixes ─────────────

    it("Start -> Queued -> Processing -> Done: results update without a reload, and polling stops after completion", async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        getOperationsBatch.mockResolvedValue(doneBatch({ status: "CREATED" }));
        getOperationsBatchProgress.mockResolvedValue(ALL_IDLE); // nothing active before Start

        render(<OperationsBatchDetailPage />);
        await waitFor(() => expect(getOperationsBatchProgress).toHaveBeenCalledTimes(1));
        const afterMount = Number(screen.getByTestId("processing-progress").textContent);

        // User clicks Start — same call ProcessingControls' real Start
        // button makes, including the leg key.
        getOperationsBatchProgress.mockResolvedValueOnce({ ...ALL_IDLE, parts: leg({ queued_count: 7 }) });
        fireEvent.click(screen.getByText("start-parts"));
        await waitFor(() => expect(getOperationsBatchProgress).toHaveBeenCalledTimes(2));
        const afterStart = Number(screen.getByTestId("processing-progress").textContent);
        expect(afterStart).toBeGreaterThan(afterMount);

        getOperationsBatchProgress.mockResolvedValueOnce({ ...ALL_IDLE, parts: leg({ processing_count: 7 }) });
        await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
        await waitFor(() => expect(getOperationsBatchProgress).toHaveBeenCalledTimes(3));
        const afterProcessing = Number(screen.getByTestId("processing-progress").textContent);
        expect(afterProcessing).toBeGreaterThan(afterStart);

        // The completing tick — THIS is the exact bug: it must still bump
        // refreshKey so every child refetches, not just the ticks while
        // still processing.
        getOperationsBatchProgress.mockResolvedValueOnce({ ...ALL_IDLE, parts: leg({ done_count: 7 }) });
        getOperationsBatch.mockResolvedValueOnce(doneBatch({ status: "DONE" }));
        await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
        await waitFor(() => expect(getOperationsBatchProgress).toHaveBeenCalledTimes(4));
        const afterDone = Number(screen.getByTestId("processing-progress").textContent);
        expect(afterDone).toBeGreaterThan(afterProcessing);
        expect(screen.getByTestId("financial-summary").textContent).toBe(String(afterDone));
        expect(screen.getByTestId("vehicle-table").textContent).toBe(String(afterDone));

        const toast = (await import("react-hot-toast")).default;
        expect(toast.success).toHaveBeenCalledWith("Parts analysis completed — 7 vehicles processed");

        // Polling must now be stopped — no further request no matter how
        // much time passes.
        await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
        expect(getOperationsBatchProgress).toHaveBeenCalledTimes(4);
    });

    it("fast completion before the first poll still shows the completion notification", async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        getOperationsBatch.mockResolvedValue(doneBatch({ status: "CREATED" }));
        getOperationsBatchProgress.mockResolvedValue(ALL_IDLE);

        render(<OperationsBatchDetailPage />);
        await waitFor(() => expect(getOperationsBatchProgress).toHaveBeenCalledTimes(1));

        // The backend finishes between the click and the very next poll —
        // marking "parts" active at click time (handleBatchUpdated) is
        // what lets this first tick's all-done result still register as
        // a genuine transition, not "it was always done".
        getOperationsBatchProgress.mockResolvedValueOnce({ ...ALL_IDLE, parts: leg({ done_count: 7 }) });
        getOperationsBatch.mockResolvedValueOnce(doneBatch({ status: "DONE" }));
        fireEvent.click(screen.getByText("start-parts"));

        await waitFor(() => expect(getOperationsBatchProgress).toHaveBeenCalledTimes(2));
        const toast = (await import("react-hot-toast")).default;
        await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Parts analysis completed — 7 vehicles processed"));

        await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
        expect(getOperationsBatchProgress).toHaveBeenCalledTimes(2); // no further polling
    });

    it("allows a Parts rerun after DONE: clicking Start again resumes polling", async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        getOperationsBatch.mockResolvedValue(doneBatch({ status: "DONE" }));
        getOperationsBatchProgress.mockResolvedValue({ ...ALL_IDLE, parts: leg({ done_count: 7 }) });

        render(<OperationsBatchDetailPage />);
        await waitFor(() => expect(getOperationsBatchProgress).toHaveBeenCalledTimes(1));

        await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
        expect(getOperationsBatchProgress).toHaveBeenCalledTimes(1); // confirmed idle, not polling

        // Rerun: Start is clicked again (backend's Phase K.8 fix allows
        // this for a DONE batch) — polling must resume.
        getOperationsBatchProgress.mockResolvedValueOnce({ ...ALL_IDLE, parts: leg({ queued_count: 7 }) });
        fireEvent.click(screen.getByText("start-parts"));
        await waitFor(() => expect(getOperationsBatchProgress).toHaveBeenCalledTimes(2));

        getOperationsBatchProgress.mockResolvedValueOnce({ ...ALL_IDLE, parts: leg({ done_count: 7 }) });
        await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
        await waitFor(() => expect(getOperationsBatchProgress).toHaveBeenCalledTimes(3));

        await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
        expect(getOperationsBatchProgress).toHaveBeenCalledTimes(3); // stopped again after the rerun's own completion
    });

    it("also polls for an active Our Database run even though OperationsBatch.status never reflects it", async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        getOperationsBatch.mockResolvedValue(doneBatch({ status: "DONE" })); // Parts already DONE — status stays DONE throughout
        getOperationsBatchProgress.mockResolvedValue(ALL_IDLE);

        render(<OperationsBatchDetailPage />);
        await waitFor(() => expect(getOperationsBatchProgress).toHaveBeenCalledTimes(1));

        getOperationsBatchProgress.mockResolvedValueOnce({ ...ALL_IDLE, ourdb: leg({ processing_count: 7 }) });
        fireEvent.click(screen.getByText("start-ourdb"));
        await waitFor(() => expect(getOperationsBatchProgress).toHaveBeenCalledTimes(2));

        getOperationsBatchProgress.mockResolvedValueOnce({ ...ALL_IDLE, ourdb: leg({ done_count: 7 }) });
        await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
        await waitFor(() => expect(getOperationsBatchProgress).toHaveBeenCalledTimes(3));

        const toast = (await import("react-hot-toast")).default;
        expect(toast.success).toHaveBeenCalledWith("Our Database analysis completed — 7 vehicles processed");
    });
});
