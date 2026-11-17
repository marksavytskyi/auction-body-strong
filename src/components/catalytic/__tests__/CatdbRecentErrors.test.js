import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as api from "@/lib/catalytic/catdbAdmin";
import toast from "react-hot-toast";
import CatdbRecentErrors from "../CatdbRecentErrors";
import { CatalyticApiError } from "@/lib/catalytic/api";

vi.mock("@/lib/catalytic/catdbAdmin", () => ({
    clearErrorHistory: vi.fn(),
    // CatdbProcessingControls (where ConfirmDialog lives) imports these too
    getControlStatus: vi.fn(), pauseProcessing: vi.fn(), resumeProcessing: vi.fn(),
    cancelAllPending: vi.fn(), stopWorker: vi.fn(), clearWorkerStop: vi.fn(),
}));
vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const ERRORS = [
    { job_id: 317, vin: "1HGCM82633A000001", error_code: "TIMEOUT", error_message: "Search timed out", status: "MANUAL_REVIEW" },
    { job_id: 300, vin: "1HGCM82633A000002", error_code: "NO_RESULT", error_message: "No result screen", status: "FAILED" },
];

// The page passes the server's list; a parent re-render with a fresh fetch is what a reload is.
function Harness({ server }) {
    const [errors, setErrors] = React.useState(server.current);
    return <CatdbRecentErrors errors={errors} onCleared={async () => setErrors([...server.current])} />;
}

const dialog = () => within(screen.getByRole("dialog"));

describe("CatdbRecentErrors", () => {
    beforeEach(() => vi.clearAllMocks());

    it("lists the errors with a Clear History button in the header", () => {
        render(<CatdbRecentErrors errors={ERRORS} />);
        expect(screen.getByRole("heading", { name: "Recent Errors" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Clear History" })).toBeInTheDocument();
        expect(screen.getByText("TIMEOUT")).toBeInTheDocument();
        expect(screen.getByText("No result screen")).toBeInTheDocument();
    });

    it("asks for confirmation with the exact wording, and Cancel clears nothing", () => {
        render(<CatdbRecentErrors errors={ERRORS} />);
        fireEvent.click(screen.getByRole("button", { name: "Clear History" }));
        expect(dialog().getByText("Clear CatDB Error History?")).toBeInTheDocument();
        expect(dialog().getByText("This will clear the displayed error history. CatDB jobs, search results, and processing data will remain unchanged.")).toBeInTheDocument();
        fireEvent.click(dialog().getByRole("button", { name: "Cancel" }));
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(api.clearErrorHistory).not.toHaveBeenCalled();
        expect(screen.getByText("TIMEOUT")).toBeInTheDocument();
    });

    it("clears, refreshes the section and shows the empty state", async () => {
        const server = { current: ERRORS };
        api.clearErrorHistory.mockImplementation(async () => { server.current = []; return { cleared_count: 2 }; });
        render(<Harness server={server} />);
        fireEvent.click(screen.getByRole("button", { name: "Clear History" }));
        fireEvent.click(dialog().getByRole("button", { name: "Clear History" }));
        expect(await screen.findByText("No recent errors")).toBeInTheDocument();
        expect(api.clearErrorHistory).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Clear History" })).not.toBeInTheDocument();
        expect(toast.success).toHaveBeenCalledWith("Cleared 2 errors");
    });

    it("shows the empty state when the server returns no errors (a reload after clearing)", () => {
        render(<CatdbRecentErrors errors={[]} />);
        expect(screen.getByText("No recent errors")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Clear History" })).not.toBeInTheDocument();
    });

    it("shows new errors that arrive after a clear", () => {
        const { rerender } = render(<CatdbRecentErrors errors={[]} />);
        rerender(<CatdbRecentErrors errors={[ERRORS[1]]} />);
        expect(screen.getByText("NO_RESULT")).toBeInTheDocument();
        expect(screen.queryByText("No recent errors")).not.toBeInTheDocument();
    });

    it("keeps the list and reports the error when the server refuses (not an administrator)", async () => {
        const onCleared = vi.fn();
        api.clearErrorHistory.mockRejectedValue(new CatalyticApiError("Not authorized", { status: 403 }));
        render(<CatdbRecentErrors errors={ERRORS} onCleared={onCleared} />);
        fireEvent.click(screen.getByRole("button", { name: "Clear History" }));
        fireEvent.click(dialog().getByRole("button", { name: "Clear History" }));
        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Not authorized"));
        expect(onCleared).not.toHaveBeenCalled();
        expect(screen.getByText("TIMEOUT")).toBeInTheDocument();
    });

    it("sends one request even when confirmed twice quickly", async () => {
        let resolve;
        api.clearErrorHistory.mockReturnValue(new Promise((r) => { resolve = r; }));
        render(<CatdbRecentErrors errors={ERRORS} />);
        fireEvent.click(screen.getByRole("button", { name: "Clear History" }));
        const confirm = dialog().getByRole("button", { name: "Clear History" });
        fireEvent.click(confirm);
        fireEvent.click(confirm);
        resolve({ cleared_count: 2 });
        await waitFor(() => expect(api.clearErrorHistory).toHaveBeenCalledTimes(1));
    });
});
