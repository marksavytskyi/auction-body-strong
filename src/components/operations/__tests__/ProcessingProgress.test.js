import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import ProcessingProgress, { progressHeadline } from "../ProcessingProgress";
import { getOperationsBatchProgress } from "@/lib/operations/api";

vi.mock("@/lib/operations/api", () => ({
    getOperationsBatchProgress: vi.fn(),
}));

// Phase K.52 — closed by default; one line per analysis with only the counts that
// aren't zero; running work and failures stay visible in the closed header.

const leg = (overrides = {}) => ({
    not_requested_count: 0, queued_count: 0, processing_count: 0, done_count: 0, failed_count: 0, no_data_count: 0, total: 0,
    ...overrides,
});

function progress(overrides = {}) {
    return {
        operations_batch_id: 7,
        total_vehicle_count: 10,
        parts: leg({ done_count: 10, total: 10 }),
        ourdb: leg({ queued_count: 3, done_count: 7, total: 10 }),
        weight: leg({ done_count: 6, no_data_count: 4, total: 10 }),
        ...overrides,
    };
}

async function show() {
    render(<ProcessingProgress batchId={7} refreshKey={0} />);
    const header = await screen.findByRole("button", { name: /Processing Progress/ });
    await waitFor(() => expect(header).not.toHaveTextContent("Loading"));
    fireEvent.click(header);
    return header;
}
const lineOf = (label) => screen.getByText(label, { selector: "span.text-xs.font-bold" }).parentElement;

describe("ProcessingProgress", () => {
    beforeEach(() => { getOperationsBatchProgress.mockReset(); });

    it("is closed by default and the header shows what is running, from real counts", async () => {
        getOperationsBatchProgress.mockResolvedValue(progress());
        render(<ProcessingProgress batchId={7} refreshKey={0} />);
        const header = await screen.findByRole("button", { name: /Processing Progress/ });
        await waitFor(() => expect(header).toHaveTextContent("Our Database running — 7 / 10 completed"));
        expect(header).toHaveAttribute("aria-expanded", "false");
        expect(header).toHaveTextContent("Running");
        expect(screen.queryByText("Parts")).toBeNull();
    });

    it("a failure shows in the closed header", () => {
        expect(progressHeadline(progress({ ourdb: leg({ done_count: 8, failed_count: 2, total: 10 }) })).status).toEqual({ label: "2 failed", tone: "danger" });
        expect(progressHeadline(progress({ ourdb: leg({ queued_count: 1, failed_count: 2, total: 10 }) })).status).toEqual({ label: "2 failed", tone: "danger" });
    });

    it("nothing started shows Not Started, with no rows of zeroes", async () => {
        const fresh = { parts: leg({ not_requested_count: 10, total: 10 }), ourdb: leg({ not_requested_count: 10, total: 10 }), weight: leg({ not_requested_count: 10, total: 10 }) };
        expect(progressHeadline(fresh)).toEqual({ summary: null, status: { label: "Not Started", tone: "neutral" } });
        getOperationsBatchProgress.mockResolvedValue(progress(fresh));
        await show();
        expect(screen.getAllByText("Not started")).toHaveLength(3);
        expect(screen.queryByText(/^0 /)).toBeNull();
    });

    it("shows one line per analysis, with only the backend's non-zero counts", async () => {
        getOperationsBatchProgress.mockResolvedValue(progress());
        await show();
        expect(lineOf("Parts")).toHaveTextContent("10 doneof 10");
        expect(lineOf("Our Database")).toHaveTextContent("3 queued7 doneof 10");
        expect(lineOf("Weight")).toHaveTextContent("6 done4 no dataof 10");
    });

    it("never shows failed for Weight or no data for Parts and Our Database", async () => {
        getOperationsBatchProgress.mockResolvedValue(progress({
            parts: leg({ done_count: 5, failed_count: 1, no_data_count: 9, total: 6 }),
            weight: leg({ done_count: 5, failed_count: 9, no_data_count: 1, total: 6 }),
        }));
        await show();
        expect(lineOf("Parts")).not.toHaveTextContent("no data");
        expect(lineOf("Parts")).toHaveTextContent("1 failed");
        expect(lineOf("Weight")).not.toHaveTextContent("failed");
        expect(lineOf("Weight")).toHaveTextContent("1 no data");
    });

    it("shows a retryable error state on a failed load, flagged in the header", async () => {
        getOperationsBatchProgress.mockRejectedValue(new Error("boom"));
        render(<ProcessingProgress batchId={7} refreshKey={0} />);
        const header = await screen.findByRole("button", { name: /Processing Progress/ });
        await waitFor(() => expect(header).toHaveTextContent("Couldn't load"));
        fireEvent.click(header);
        expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    });

    it("refetches when the page's refresh key changes", async () => {
        getOperationsBatchProgress.mockResolvedValue(progress());
        const { rerender } = render(<ProcessingProgress batchId={7} refreshKey={0} />);
        await waitFor(() => expect(getOperationsBatchProgress).toHaveBeenCalledTimes(1));
        rerender(<ProcessingProgress batchId={7} refreshKey={1} />);
        await waitFor(() => expect(getOperationsBatchProgress).toHaveBeenCalledTimes(2));
    });
});
