import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import ProcessingControls from "../ProcessingControls";
import { startOperationsParts, startOperationsOurDb, startOperationsWeight, getOperationsBatchProgress } from "@/lib/operations/api";

vi.mock("@/lib/operations/api", () => ({
    startOperationsParts: vi.fn(),
    startOperationsOurDb: vi.fn(),
    startOperationsWeight: vi.fn(),
    getOperationsBatchProgress: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
    default: { success: vi.fn(), error: vi.fn() },
}));

const baseBatch = { id: 1, run_parts: true, run_ourdb: true, run_weight: true, parts_job_status: null };

const emptyLeg = { not_requested_count: 0, queued_count: 0, processing_count: 0, done_count: 0, failed_count: 0, no_data_count: 0, total: 0 };
const baseProgress = { parts: { ...emptyLeg }, ourdb: { ...emptyLeg }, weight: { ...emptyLeg } };

describe("ProcessingControls", () => {
    beforeEach(() => {
        startOperationsParts.mockReset();
        startOperationsOurDb.mockReset();
        startOperationsWeight.mockReset();
        getOperationsBatchProgress.mockReset();
        getOperationsBatchProgress.mockResolvedValue(baseProgress);
    });

    it("starting Parts only calls the Parts endpoint, never OurDB or Weight", async () => {
        startOperationsParts.mockResolvedValue({ ...baseBatch, parts_job_status: "processing" });
        render(<ProcessingControls batch={baseBatch} onBatchUpdated={vi.fn()} />);

        fireEvent.click(screen.getAllByRole("button", { name: /^start$/i })[0]);

        await waitFor(() => expect(startOperationsParts).toHaveBeenCalledWith(1));
        expect(startOperationsOurDb).not.toHaveBeenCalled();
        expect(startOperationsWeight).not.toHaveBeenCalled();
    });

    it("starting Our Database only calls the OurDB endpoint, never Parts or Weight — and never CatDB", async () => {
        startOperationsOurDb.mockResolvedValue(baseBatch);
        render(<ProcessingControls batch={baseBatch} onBatchUpdated={vi.fn()} />);

        fireEvent.click(screen.getAllByRole("button", { name: /^start$/i })[1]);

        await waitFor(() => expect(startOperationsOurDb).toHaveBeenCalledWith(1));
        expect(startOperationsParts).not.toHaveBeenCalled();
        expect(startOperationsWeight).not.toHaveBeenCalled();
    });

    it("starting Weight only calls the Weight endpoint", async () => {
        startOperationsWeight.mockResolvedValue(baseBatch);
        render(<ProcessingControls batch={baseBatch} onBatchUpdated={vi.fn()} />);

        fireEvent.click(screen.getAllByRole("button", { name: /^start$/i })[2]);

        await waitFor(() => expect(startOperationsWeight).toHaveBeenCalledWith(1));
        expect(startOperationsParts).not.toHaveBeenCalled();
        expect(startOperationsOurDb).not.toHaveBeenCalled();
    });

    it("disables Start for a leg the batch has disabled", async () => {
        render(<ProcessingControls batch={{ ...baseBatch, run_weight: false }} onBatchUpdated={vi.fn()} />);
        await waitFor(() => expect(getOperationsBatchProgress).toHaveBeenCalled());
        const buttons = screen.getAllByRole("button", { name: /^start$/i });
        expect(buttons[2]).toBeDisabled();
        expect(screen.getByText(/disabled for this batch/i)).toBeInTheDocument();
    });

    it("shows the real backend progress counts rather than fabricated client-only status", async () => {
        getOperationsBatchProgress.mockResolvedValue({
            ...baseProgress,
            parts: { not_requested_count: 0, queued_count: 0, processing_count: 0, done_count: 10, failed_count: 0, no_data_count: 0, total: 10 },
        });
        render(<ProcessingControls batch={baseBatch} onBatchUpdated={vi.fn()} />);
        expect(await screen.findByText(/done \(10\/10\)/i)).toBeInTheDocument();
    });

    it("shows 'Not started' when the backend progress says every vehicle is still not_requested", async () => {
        getOperationsBatchProgress.mockResolvedValue({
            ...baseProgress,
            weight: { ...emptyLeg, not_requested_count: 5, total: 5 },
        });
        render(<ProcessingControls batch={baseBatch} onBatchUpdated={vi.fn()} />);
        expect(await screen.findAllByText(/not started/i)).not.toHaveLength(0);
    });

    it("uses a progress prop when the parent already fetched it, avoiding a duplicate request", async () => {
        const progress = {
            ...baseProgress,
            parts: { ...emptyLeg, processing_count: 3, done_count: 2, total: 5 },
        };
        render(<ProcessingControls batch={baseBatch} progress={progress} onBatchUpdated={vi.fn()} />);
        expect(await screen.findByText(/processing \(2\/5 done\)/i)).toBeInTheDocument();
        expect(getOperationsBatchProgress).not.toHaveBeenCalled();
    });

    // ─── Phase H/I-B: progress must not go stale during polling ─────────

    it("refetches progress when refreshKey changes, staying in sync with the page's own poll tick (no second interval)", async () => {
        getOperationsBatchProgress.mockResolvedValueOnce({
            ...baseProgress,
            parts: { ...emptyLeg, processing_count: 8, done_count: 2, total: 10 },
        });
        const { rerender } = render(<ProcessingControls batch={baseBatch} refreshKey={0} onBatchUpdated={vi.fn()} />);
        expect(await screen.findByText(/processing \(2\/10 done\)/i)).toBeInTheDocument();
        expect(getOperationsBatchProgress).toHaveBeenCalledTimes(1);

        getOperationsBatchProgress.mockResolvedValueOnce({
            ...baseProgress,
            parts: { ...emptyLeg, done_count: 10, total: 10 },
        });
        rerender(<ProcessingControls batch={baseBatch} refreshKey={1} onBatchUpdated={vi.fn()} />);

        expect(await screen.findByText(/done \(10\/10\)/i)).toBeInTheDocument();
        expect(getOperationsBatchProgress).toHaveBeenCalledTimes(2);
        expect(screen.queryByText(/processing \(2\/10 done\)/i)).not.toBeInTheDocument();
    });

    it("never refetches on a refreshKey change when a progress prop already controls it", async () => {
        const progress = { ...baseProgress, parts: { ...emptyLeg, processing_count: 4, done_count: 4, total: 10 } };
        const { rerender } = render(<ProcessingControls batch={baseBatch} progress={progress} refreshKey={0} onBatchUpdated={vi.fn()} />);
        expect(await screen.findByText(/processing \(4\/10 done\)/i)).toBeInTheDocument();

        rerender(<ProcessingControls batch={baseBatch} progress={progress} refreshKey={1} onBatchUpdated={vi.fn()} />);
        expect(getOperationsBatchProgress).not.toHaveBeenCalled();
    });

    // ─── Phase K.9: Start stays disabled while genuinely running ────────

    it("disables Start for a leg that is actively queued or processing, even though the batch allows it", async () => {
        const progress = { ...baseProgress, parts: { ...emptyLeg, processing_count: 3, done_count: 2, total: 5 } };
        render(<ProcessingControls batch={baseBatch} progress={progress} onBatchUpdated={vi.fn()} />);
        const buttons = await screen.findAllByRole("button", { name: /^start$/i });
        expect(buttons[0]).toBeDisabled(); // Parts
        expect(buttons[1]).not.toBeDisabled(); // OurDB — untouched by Parts' own activity
    });

    it("re-enables Start (allowing a rerun) once a DONE/FAILED leg is no longer active", async () => {
        const progress = { ...baseProgress, parts: { ...emptyLeg, done_count: 5, total: 5 } };
        render(<ProcessingControls batch={baseBatch} progress={progress} onBatchUpdated={vi.fn()} />);
        const buttons = await screen.findAllByRole("button", { name: /^start$/i });
        expect(buttons[0]).not.toBeDisabled();
    });

    it("tells the parent which leg was started, so its poll loop can mark it active immediately", async () => {
        startOperationsParts.mockResolvedValue({ id: 1, status: "PROCESSING" });
        const onBatchUpdated = vi.fn();
        render(<ProcessingControls batch={baseBatch} progress={baseProgress} onBatchUpdated={onBatchUpdated} />);
        fireEvent.click(screen.getAllByRole("button", { name: /^start$/i })[0]);
        await waitFor(() => expect(onBatchUpdated).toHaveBeenCalledWith({ id: 1, status: "PROCESSING" }, "parts"));
    });
});
