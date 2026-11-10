import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import ProcessingProgress, { progressHeadline, serviceRows } from "../ProcessingProgress";
import { getOperationsBatchProgress, getOperationsCatalytic } from "@/lib/operations/api";

vi.mock("@/lib/operations/api", () => ({ getOperationsBatchProgress: vi.fn(), getOperationsCatalytic: vi.fn() }));

// Phase K.53 — every service on its own row, from the backend's stored statuses only.

const leg = (o = {}) => ({ not_requested_count: 0, queued_count: 0, processing_count: 0, done_count: 0, failed_count: 0, no_data_count: 0, total: 1, ...o });
const progress = (o = {}) => ({ total_vehicle_count: 1, parts: leg({ done_count: 1 }), ourdb: leg({ done_count: 1 }), weight: leg({ no_data_count: 1 }), ...o });
const src = (source, selected, status, counts) => ({ source, selected, status, counts, priced: 0 });
const overview = (o = {}) => ({
    sources: [
        src("OUR_DATABASE", true, "COMPLETE", { DONE: 1 }),
        src("CATDB_LOCAL", true, "COMPLETED", { COMPLETED: 1 }),
        src("ECOTRADE_LOCAL", true, "COMPLETED", { COMPLETED: 1 }),
        src("CATDB_VIN", true, "QUEUED", { QUEUED: 1 }),
    ],
    catdb_queue: { states: { WAITING_FOR_DEVICE: 1 }, text: "Waiting for a device: phone-01 is DEGRADED (last heartbeat 5 min ago)." },
    ...o,
});
const byName = (rows) => Object.fromEntries(rows.map((r) => [r.name, r]));

async function show() {
    render(<ProcessingProgress batchId={7} refreshKey={0} />);
    const header = await screen.findByRole("button", { name: /Processing Progress/ });
    await waitFor(() => expect(header).not.toHaveTextContent("Loading"));
    fireEvent.click(header);
    return header;
}

beforeEach(() => {
    vi.clearAllMocks();
    getOperationsBatchProgress.mockResolvedValue(progress());
    getOperationsCatalytic.mockResolvedValue(overview());
});

describe("ProcessingProgress", () => {
    it("shows all seven services, CatDB VIN included", async () => {
        await show();
        for (const name of ["Parts Analysis", "Weight Analysis", "Our Database", "CatDB Local", "EcoTrade Local", "CatDB VIN"]) {
            expect(screen.getByText(name)).toBeInTheDocument();
        }
    });

    it("the owner's case: four sources selected, CatDB VIN waiting for the device", () => {
        const rows = byName(serviceRows(progress(), overview()));
        expect(rows["Parts Analysis"].state.label).toBe("Completed");
        expect(rows["Weight Analysis"].state.label).toBe("Completed"); // finished with no data is finished
        expect(rows["Our Database"].state.label).toBe("Completed");
        expect(rows["CatDB Local"].state.label).toBe("Completed");
        expect(rows["CatDB VIN"].state.label).toBe("Waiting for device");
        expect(rows["CatDB VIN"].counts).toMatchObject({ completed: 0, total: 1 });
    });

    it("the CatDB VIN waiting reason from the backend is shown", async () => {
        await show();
        const row = screen.getByText("CatDB VIN").closest("[data-service]");
        expect(row).toHaveTextContent("0/1 completed");
        expect(row).toHaveTextContent("Waiting for device");
        expect(row).toHaveTextContent("phone-01 is DEGRADED");
    });

    it("never says Completed while a selected service is still waiting", async () => {
        const header = await show();
        expect(header).not.toHaveTextContent(/COMPLETED$/);
        expect(header).toHaveTextContent("5 of 6 services completed");
        expect(header).toHaveTextContent("CatDB VIN: Waiting for device");
    });

    it("paused, stale, running and review are told apart", () => {
        const vin = (states, counts) => byName(serviceRows(progress(), overview({
            sources: [src("OUR_DATABASE", true, "COMPLETE", { DONE: 1 }), src("CATDB_LOCAL", false, "NOT_REQUESTED", { NOT_REQUESTED: 1 }), src("ECOTRADE_LOCAL", false, "NOT_REQUESTED", { NOT_REQUESTED: 1 }), src("CATDB_VIN", true, "X", counts)],
            catdb_queue: { states, text: null },
        })))["CatDB VIN"].state.label;
        expect(vin({ PAUSED: 1 }, { QUEUED: 1 })).toBe("Paused");
        expect(vin({ STALE: 1 }, { QUEUED: 1 })).toBe("Device stopped reporting");
        expect(vin({}, { PROCESSING: 1 })).toBe("Running");
        expect(vin({}, { REVIEW_REQUIRED: 1 })).toBe("1 require review");
        expect(vin({}, { NO_RESULT: 1 })).toBe("Completed"); // no result is a finished search, not a failure
    });

    it("selected-but-never-run and never-requested are different", () => {
        const rows = byName(serviceRows(progress(), overview({
            sources: [src("OUR_DATABASE", true, "NOT_STARTED", { NOT_REQUESTED: 1 }), src("CATDB_LOCAL", false, "NOT_REQUESTED", { NOT_REQUESTED: 1 }), src("ECOTRADE_LOCAL", false, "NOT_REQUESTED", { NOT_REQUESTED: 1 }), src("CATDB_VIN", false, "NOT_REQUESTED", { NOT_REQUESTED: 1 })],
            catdb_queue: { states: {}, text: null },
        })));
        expect(rows["CatDB Local"].state.label).toBe("Not requested");
    });

    it("failures and review stay visible when collapsed", () => {
        const rows = serviceRows(progress({ parts: leg({ failed_count: 1 }) }), overview({ catdb_queue: { states: {}, text: null }, sources: [src("OUR_DATABASE", true, "COMPLETE", { DONE: 1 }), src("CATDB_LOCAL", true, "COMPLETED", { COMPLETED: 1 }), src("ECOTRADE_LOCAL", true, "COMPLETED", { COMPLETED: 1 }), src("CATDB_VIN", true, "REVIEW_REQUIRED", { REVIEW_REQUIRED: 1 })] }));
        expect(progressHeadline(rows).status).toEqual({ label: "1 failed", tone: "danger" });
    });

    it("nothing started shows Not Started", () => {
        const fresh = progress({ parts: leg({ not_requested_count: 1 }), ourdb: leg({ not_requested_count: 1 }), weight: leg({ not_requested_count: 1 }) });
        const rows = serviceRows(fresh, overview({ sources: ["OUR_DATABASE", "CATDB_LOCAL", "ECOTRADE_LOCAL", "CATDB_VIN"].map((s) => src(s, false, "NOT_REQUESTED", { NOT_REQUESTED: 1 })), catdb_queue: { states: {}, text: null } }));
        expect(progressHeadline(rows).status.label).toBe("Not Started");
    });

    it("is closed by default; a failed load is retryable and flagged", async () => {
        getOperationsBatchProgress.mockRejectedValue(new Error("boom"));
        render(<ProcessingProgress batchId={7} refreshKey={0} />);
        const header = await screen.findByRole("button", { name: /Processing Progress/ });
        expect(header).toHaveAttribute("aria-expanded", "false");
        await waitFor(() => expect(header).toHaveTextContent("Couldn't load"));
        fireEvent.click(header);
        expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    });

    it("still shows Parts, Weight and Our Database if the catalytic overview fails", async () => {
        getOperationsCatalytic.mockRejectedValue(new Error("x"));
        await show();
        expect(screen.getByText("Parts Analysis")).toBeInTheDocument();
        expect(screen.getByText("Catalytic source progress couldn't be loaded.")).toBeInTheDocument();
    });

    it("refetches when the page's refresh key changes", async () => {
        const { rerender } = render(<ProcessingProgress batchId={7} refreshKey={0} />);
        await waitFor(() => expect(getOperationsBatchProgress).toHaveBeenCalledTimes(1));
        rerender(<ProcessingProgress batchId={7} refreshKey={1} />);
        await waitFor(() => expect(getOperationsBatchProgress).toHaveBeenCalledTimes(2));
    });
});
