import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as api from "@/lib/catalytic/catdbAdmin";
import CatdbProcessingControls from "../CatdbProcessingControls";

vi.mock("@/lib/catalytic/catdbAdmin", () => ({
    getControlStatus: vi.fn(), pauseProcessing: vi.fn(), resumeProcessing: vi.fn(),
    cancelAllPending: vi.fn(), stopWorker: vi.fn(), clearWorkerStop: vi.fn(),
}));
vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const worker = (extra = {}) => ({
    id: 8, name: "phone-01", is_active: true, effective_status: "OFFLINE", reported_status: "ONLINE",
    last_seen_at: "2026-11-01T07:34:32", current_job_id: null, current_vin: null, worker_version: "0.1.0-android",
    stop_state: "NONE", stop_requested_at: null, stop_acknowledged_at: null, last_error: null, ...extra,
});
const status = (extra = {}) => ({
    paused: true, reason: "", changed_at: null, pending: 1, leased: 0, running: 0, cancelled: 1, completed: 243,
    failed: 10, manual_review: 37, search_in_flight_job_ids: [], workers: [worker()], ...extra,
});
const dialog = () => within(screen.getByRole("dialog"));

describe("CatdbProcessingControls", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        api.getControlStatus.mockResolvedValue(status());
    });

    it("shows real state from the backend, with a paused state offering only Resume", async () => {
        render(<CatdbProcessingControls />);
        expect(await screen.findByText("Processing: Paused")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Resume Processing" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Pause Processing" })).not.toBeInTheDocument();
        expect(screen.getByText(/phone-01 \(#8\): OFFLINE/)).toBeInTheDocument();
        expect(screen.getByText(/Last heartbeat/)).toBeInTheDocument();
    });

    it("never presents a sent request as a stopped worker", async () => {
        api.getControlStatus.mockResolvedValue(status({ workers: [worker({ stop_state: "REQUEST_SENT" })] }));
        render(<CatdbProcessingControls />);
        expect(await screen.findByText(/REQUEST SENT, not acknowledged/)).toBeInTheDocument();
        expect(screen.queryByText(/WORKER STOPPED/)).not.toBeInTheDocument();
    });

    it("shows a stopped worker only after the device confirmed", async () => {
        api.getControlStatus.mockResolvedValue(status({ workers: [worker({ stop_state: "WORKER_STOPPED" })] }));
        render(<CatdbProcessingControls />);
        expect(await screen.findByText(/WORKER STOPPED \(device confirmed\)/)).toBeInTheDocument();
    });

    it("needs confirmation before resuming and explains cancelled jobs stay cancelled", async () => {
        api.resumeProcessing.mockResolvedValue(status({ paused: false }));
        render(<CatdbProcessingControls />);
        fireEvent.click(await screen.findByRole("button", { name: "Resume Processing" }));
        expect(api.resumeProcessing).not.toHaveBeenCalled();
        expect(dialog().getByText(/Cancelled jobs stay cancelled/)).toBeInTheDocument();
        fireEvent.click(dialog().getByRole("button", { name: "Resume" }));
        expect(await screen.findByText("Processing: Running")).toBeInTheDocument();
        expect(api.resumeProcessing).toHaveBeenCalledTimes(1);
    });

    it("explains what Cancel All keeps, and a double tap sends one request", async () => {
        let finish;
        api.cancelAllPending.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
        const onChanged = vi.fn();
        render(<CatdbProcessingControls onChanged={onChanged} />);
        fireEvent.click(await screen.findByRole("button", { name: "Cancel All Pending" }));
        expect(dialog().getByText(/Completed results and history are kept/)).toBeInTheDocument();
        const confirm = dialog().getByRole("button", { name: "Cancel jobs" });
        fireEvent.click(confirm);
        fireEvent.click(confirm);
        expect(api.cancelAllPending).toHaveBeenCalledTimes(1);
        finish({ cancelled_job_ids: [41], search_already_submitted_job_ids: [] });
        await waitFor(() => expect(onChanged).toHaveBeenCalled());
    });

    it("Go back cancels nothing", async () => {
        render(<CatdbProcessingControls />);
        fireEvent.click(await screen.findByRole("button", { name: "Cancel All Pending" }));
        fireEvent.click(dialog().getByRole("button", { name: "Go back" }));
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(api.cancelAllPending).not.toHaveBeenCalled();
    });

    it("disables Cancel All when nothing is active", async () => {
        api.getControlStatus.mockResolvedValue(status({ pending: 0 }));
        render(<CatdbProcessingControls />);
        expect(await screen.findByRole("button", { name: "Cancel All Pending" })).toBeDisabled();
    });

    it("sends a stop request and keeps saying it's only a request", async () => {
        api.stopWorker.mockResolvedValue(status({ workers: [worker({ stop_state: "REQUEST_SENT" })] }));
        render(<CatdbProcessingControls />);
        fireEvent.click(await screen.findByRole("button", { name: "Stop Active Worker" }));
        expect(dialog().getByText(/can't be interrupted/)).toBeInTheDocument();
        fireEvent.click(dialog().getByRole("button", { name: "Send stop request" }));
        expect(await screen.findByText(/REQUEST SENT/)).toBeInTheDocument();
        expect(api.stopWorker).toHaveBeenCalledWith(8);
    });

    it("keeps the dialog open and the state unchanged when an action fails", async () => {
        api.resumeProcessing.mockRejectedValue(new Error("nope"));
        render(<CatdbProcessingControls />);
        fireEvent.click(await screen.findByRole("button", { name: "Resume Processing" }));
        fireEvent.click(dialog().getByRole("button", { name: "Resume" }));
        await waitFor(() => expect(api.resumeProcessing).toHaveBeenCalled());
        expect(await screen.findByRole("dialog")).toBeInTheDocument();
        expect(screen.getByText("Processing: Paused")).toBeInTheDocument();
    });

    it("shows a retry rather than fake status when the status can't load", async () => {
        api.getControlStatus.mockRejectedValue(new Error("down"));
        render(<CatdbProcessingControls />);
        expect(await screen.findByRole("button", { name: "Retry" })).toBeInTheDocument();
        expect(screen.queryByText(/Processing:/)).not.toBeInTheDocument();
    });
});
