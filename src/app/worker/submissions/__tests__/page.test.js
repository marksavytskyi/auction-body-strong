import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import MySubmissionsPage from "../page";
import { cancelCapture, listCaptures } from "@/lib/catalytic/workerCaptures";
import { CatalyticApiError } from "@/lib/catalytic/api";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/catalytic/workerCaptures", async () => ({
    ...(await vi.importActual("@/lib/catalytic/workerCaptures")),
    listCaptures: vi.fn(), cancelCapture: vi.fn(),
}));

const row = (overrides) => ({ id: 1, status: "PENDING_REVIEW", revision: 1, year: 2017, make: "Chevrolet", model: "Tahoe", catalysts: [], created_at: "2026-11-01T00:00:00", ...overrides });

beforeEach(() => {
    vi.clearAllMocks();
    listCaptures.mockResolvedValue([row({})]);
});

describe("My Submissions", () => {
    it("has a Cancelled filter", async () => {
        render(<MySubmissionsPage />);
        fireEvent.click(await screen.findByRole("button", { name: "Cancelled" }));
        await waitFor(() => expect(listCaptures).toHaveBeenCalledWith({ status: "CANCELLED" }));
    });

    it("offers View, Edit and Cancel on a pending submission", async () => {
        render(<MySubmissionsPage />);
        fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
        expect(push).toHaveBeenCalledWith("/worker/captures/1/edit");
        fireEvent.click(screen.getByRole("button", { name: "View" }));
        expect(push).toHaveBeenCalledWith("/worker/captures/1");
    });

    it.each(["APPROVED", "CANCELLED", "REJECTED", "DRAFT"])("offers neither Edit nor Cancel on %s", async (status) => {
        listCaptures.mockResolvedValue([row({ status })]);
        render(<MySubmissionsPage />);
        await screen.findByText("2017 Chevrolet Tahoe");
        expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "View" })).not.toBeInTheDocument();
    });

    it("confirms before cancelling, and sends the revision read", async () => {
        cancelCapture.mockResolvedValue(row({ status: "CANCELLED" }));
        listCaptures.mockResolvedValue([row({ revision: 4 })]);
        render(<MySubmissionsPage />);
        fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
        const dialog = screen.getByRole("dialog", { name: "Cancel this submission?" });
        expect(within(dialog).getByText("It will be removed from the moderator review queue.")).toBeInTheDocument();
        expect(cancelCapture).not.toHaveBeenCalled();
        fireEvent.click(within(dialog).getByRole("button", { name: "Cancel Submission" }));
        await waitFor(() => expect(cancelCapture).toHaveBeenCalledWith(1, { expectedRevision: 4 }));
        await waitFor(() => expect(listCaptures).toHaveBeenCalledTimes(2));
    });

    it("Keep Submission changes nothing", async () => {
        render(<MySubmissionsPage />);
        fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
        fireEvent.click(screen.getByRole("button", { name: "Keep Submission" }));
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(cancelCapture).not.toHaveBeenCalled();
    });

    it("shows a refused cancel and stays open", async () => {
        cancelCapture.mockRejectedValue(new CatalyticApiError("This submission was approved and can no longer be changed.", { status: 409 }));
        render(<MySubmissionsPage />);
        fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
        fireEvent.click(screen.getByRole("button", { name: "Cancel Submission" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("approved");
    });
});
