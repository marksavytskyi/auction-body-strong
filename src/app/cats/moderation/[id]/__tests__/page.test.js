import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ModerationDetailPage from "../page";
import { approveCapture, getCaptureDetail, getReviewLog, rejectCapture } from "@/lib/catalytic/moderation";
import { CatalyticApiError } from "@/lib/catalytic/api";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useParams: () => ({ id: "5" }), useRouter: () => ({ push }) }));
vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/catalytic/moderation", () => ({
    approveCapture: vi.fn(), getCaptureDetail: vi.fn(), getReviewLog: vi.fn(), rejectCapture: vi.fn(),
}));

const detail = (overrides = {}) => ({
    id: 5, status: "PENDING_REVIEW", revision: 1, year: 2017, make: "Chevrolet", model: "Tahoe", vin: "", engine: "", notes: "",
    submitted_at: "2026-11-01T10:00:00", edited_at: null, submitted_by_user_id: 1, suggestions: [],
    catalysts: [{ id: 10, position_code: "front", physical_code_raw: "ABC1", code_unreadable: false, notes: "", photos: [] }],
    ...overrides,
});
const STALE = "This submission has changed. Refresh to review the latest version.";

beforeEach(() => {
    vi.clearAllMocks();
    getCaptureDetail.mockResolvedValue(detail());
    getReviewLog.mockResolvedValue([]);
});

describe("revisions", () => {
    it("shows no banner on a first submission", async () => {
        render(<ModerationDetailPage />);
        await screen.findByText("2017 Chevrolet Tahoe");
        expect(screen.queryByTestId("updated-after-submission")).not.toBeInTheDocument();
    });

    it("shows what changed after submission", async () => {
        getCaptureDetail.mockResolvedValue(detail({ revision: 2, edited_at: "2026-11-02T10:00:00" }));
        getReviewLog.mockResolvedValue([
            { id: 1, action: "SUBMIT", actor_user_id: 1, reason: "", created_at: "2026-11-01T10:00:00" },
            {
                id: 2, action: "EDIT_RESUBMIT", actor_user_id: 1, reason: "", revision: 2, created_at: "2026-11-02T10:00:00",
                changes: {
                    vehicle: [{ field: "make", from: "Ford", to: "Chevrolet" }, { field: "engine", from: "", to: "5.3L" }],
                    catalysts: [
                        { action: "CHANGED", id: 10, fields: [{ field: "physical_code_raw", from: "A", to: "ABC1" }], photos_added: [7], photos_removed: [] },
                        { action: "REMOVED", id: 11, position_code: "rear_left", physical_code_raw: "OLD" },
                        { action: "ADDED", id: 12, position_code: "rear", physical_code_raw: "" },
                    ],
                },
            },
        ]);
        render(<ModerationDetailPage />);
        const banner = await screen.findByTestId("updated-after-submission");
        expect(banner).toHaveTextContent(/Updated after submission/i);
        expect(banner).toHaveTextContent("Revision: 2");
        await waitFor(() => expect(banner).toHaveTextContent("Make: Ford → Chevrolet"));
        expect(banner).toHaveTextContent("Engine: blank → 5.3L");
        expect(banner).toHaveTextContent("Catalyst Code: A → ABC1");
        expect(banner).toHaveTextContent("1 photo added");
        expect(banner).toHaveTextContent("Catalyst removed: rear left OLD");
        expect(banner).toHaveTextContent("Catalyst added: rear (unreadable)");
    });

    it("approves the revision on screen", async () => {
        getCaptureDetail.mockResolvedValue(detail({ revision: 3 }));
        approveCapture.mockResolvedValue({});
        render(<ModerationDetailPage />);
        fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
        await waitFor(() => expect(approveCapture).toHaveBeenCalledWith("5", expect.objectContaining({ expected_revision: 3 })));
    });

    it("rejects the revision on screen", async () => {
        getCaptureDetail.mockResolvedValue(detail({ revision: 3 }));
        rejectCapture.mockResolvedValue({});
        render(<ModerationDetailPage />);
        fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
        const reason = screen.getAllByRole("textbox").at(-1);
        fireEvent.change(reason, { target: { value: "blurry" } });
        fireEvent.click(screen.getByRole("button", { name: "Confirm Reject" }));
        await waitFor(() => expect(rejectCapture).toHaveBeenCalledWith("5", { reason: "blurry", moderatorNotes: "", expectedRevision: 3 }));
    });

    it("a stale approval says so, reloads the latest and clears overrides", async () => {
        approveCapture.mockRejectedValue(new CatalyticApiError(STALE, { status: 409 }));
        render(<ModerationDetailPage />);
        fireEvent.change(await screen.findByPlaceholderText("ABC1"), { target: { value: "TYPO" } });
        getCaptureDetail.mockResolvedValue(detail({ revision: 2, make: "GMC" }));
        fireEvent.click(screen.getByRole("button", { name: "Approve" }));
        expect(await screen.findByRole("alert")).toHaveTextContent(STALE);
        await screen.findByText("2017 GMC Tahoe");
        expect(screen.getByPlaceholderText("ABC1")).toHaveValue("");
        expect(push).not.toHaveBeenCalled();
    });

    it("a stale approval can then approve the latest revision", async () => {
        approveCapture.mockRejectedValueOnce(new CatalyticApiError(STALE, { status: 409 })).mockResolvedValueOnce({});
        render(<ModerationDetailPage />);
        getCaptureDetail.mockResolvedValue(detail({ revision: 2 }));
        fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
        await screen.findByRole("alert");
        fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
        await waitFor(() => expect(approveCapture).toHaveBeenLastCalledWith("5", expect.objectContaining({ expected_revision: 2 })));
    });

    it("a duplicate VIN is still a toast, not a reload", async () => {
        const toast = (await import("react-hot-toast")).default;
        approveCapture.mockRejectedValue(new CatalyticApiError("VIN X already has an approved vehicle instance", { status: 409 }));
        render(<ModerationDetailPage />);
        fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
        await waitFor(() => expect(toast.error).toHaveBeenCalled());
        expect(getCaptureDetail).toHaveBeenCalledTimes(1);
    });

    it("a cancelled submission offers no review", async () => {
        getCaptureDetail.mockResolvedValue(detail({ status: "CANCELLED", cancelled_at: "2026-11-02T10:00:00" }));
        render(<ModerationDetailPage />);
        expect(await screen.findByText(/The worker cancelled this submission/)).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
    });
});
