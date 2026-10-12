import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import WorkerCaptureBuilderPage from "../page";
import {
    getCapture,
    deleteCapture,
    addCatalyst,
    updateCatalyst,
    deleteCatalyst,
    uploadCatalystPhoto,
    deletePhoto,
    submitCapture,
    reopenCapture,
} from "@/lib/catalytic/workerCaptures";
import { CatalyticApiError } from "@/lib/catalytic/api";

vi.mock("next/navigation", () => ({
    useParams: () => ({ id: "1" }),
    useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/catalytic/workerCaptures", async () => {
    const actual = await vi.importActual("@/lib/catalytic/workerCaptures");
    return {
        ...actual,
        getCapture: vi.fn(),
        deleteCapture: vi.fn(),
        addCatalyst: vi.fn(),
        updateCatalyst: vi.fn(),
        deleteCatalyst: vi.fn(),
        uploadCatalystPhoto: vi.fn(),
        deletePhoto: vi.fn(),
        submitCapture: vi.fn(),
        reopenCapture: vi.fn(),
    };
});

vi.mock("react-hot-toast", () => ({
    default: { error: vi.fn(), success: vi.fn() },
}));

function baseCapture(overrides = {}) {
    return {
        id: 1,
        status: "DRAFT",
        vin: "1GNSKCKC8HR225261",
        year: 2017,
        make: "Chevrolet",
        model: "Tahoe",
        engine: "5.3L V8",
        notes: "",
        moderator_notes: "",
        submitted_at: null,
        reviewed_at: null,
        catalysts: [],
        ...overrides,
    };
}

function catalyst(overrides = {}) {
    return {
        id: 10,
        vehicle_capture_id: 1,
        position_code: "front",
        physical_code_raw: "ABC123",
        code_unreadable: false,
        notes: "",
        final_position_code: null,
        final_physical_code_raw: null,
        photos: [],
        ...overrides,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    window.confirm = vi.fn(() => true);
});

describe("WorkerCaptureBuilderPage — multiple catalysts", () => {
    it("renders two separate cards for two catalysts with the identical stamped code", async () => {
        getCapture.mockResolvedValue(
            baseCapture({
                catalysts: [
                    catalyst({ id: 10, position_code: "front", physical_code_raw: "ABC123", photos: [{ id: 100, view_url: "https://x/1" }] }),
                    catalyst({ id: 11, position_code: "rear", physical_code_raw: "ABC123", photos: [{ id: 101, view_url: "https://x/2" }] }),
                ],
            })
        );
        render(<WorkerCaptureBuilderPage />);

        await waitFor(() => expect(screen.getByText("Catalysts (2)")).toBeInTheDocument());
        const codes = screen.getAllByText("ABC123");
        expect(codes).toHaveLength(2); // never merged into one card
        expect(screen.getByText("Catalyst #1")).toBeInTheDocument();
        expect(screen.getByText("Catalyst #2")).toBeInTheDocument();
    });

    it("adds a new catalyst via the Add Catalyst form", async () => {
        getCapture.mockResolvedValue(baseCapture({ catalysts: [catalyst()] }));
        addCatalyst.mockResolvedValue(catalyst({ id: 11, position_code: "rear", physical_code_raw: "XYZ789" }));
        render(<WorkerCaptureBuilderPage />);

        await waitFor(() => screen.getByText("Catalysts (1)"));
        fireEvent.click(screen.getByRole("button", { name: /add another catalyst/i }));

        fireEvent.change(screen.getByPlaceholderText(/position/i), { target: { value: "rear" } });
        fireEvent.change(screen.getByPlaceholderText(/stamped code/i), { target: { value: "xyz789" } });
        fireEvent.click(screen.getByRole("button", { name: /add catalyst/i }));

        await waitFor(() =>
            expect(addCatalyst).toHaveBeenCalledWith("1", expect.objectContaining({ position_code: "rear", physical_code_raw: "XYZ789", code_unreadable: false }))
        );
    });
});

describe("WorkerCaptureBuilderPage — code / unreadable validation", () => {
    it("blocks adding a catalyst with neither a code nor the unreadable flag", async () => {
        getCapture.mockResolvedValue(baseCapture({ catalysts: [] }));
        render(<WorkerCaptureBuilderPage />);

        await waitFor(() => screen.getByText("Catalysts (0)"));
        fireEvent.click(screen.getByRole("button", { name: /add another catalyst/i }));

        const addButton = screen.getByRole("button", { name: /add catalyst/i });
        expect(addButton).toBeDisabled();
        expect(screen.getByText(/enter a stamped code, or check/i)).toBeInTheDocument();
        expect(addCatalyst).not.toHaveBeenCalled();
    });

    it("allows adding a catalyst when marked unreadable with no code", async () => {
        getCapture.mockResolvedValue(baseCapture({ catalysts: [] }));
        addCatalyst.mockResolvedValue(catalyst({ id: 12, code_unreadable: true, physical_code_raw: "" }));
        render(<WorkerCaptureBuilderPage />);

        await waitFor(() => screen.getByText("Catalysts (0)"));
        fireEvent.click(screen.getByRole("button", { name: /add another catalyst/i }));
        fireEvent.click(screen.getByLabelText(/code unreadable/i));
        fireEvent.click(screen.getByRole("button", { name: /add catalyst/i }));

        await waitFor(() => expect(addCatalyst).toHaveBeenCalledWith("1", expect.objectContaining({ code_unreadable: true, physical_code_raw: "" })));
    });

    it("shows a warning badge on an existing catalyst missing both code and unreadable", async () => {
        getCapture.mockResolvedValue(
            baseCapture({ catalysts: [catalyst({ physical_code_raw: "", code_unreadable: false })] })
        );
        render(<WorkerCaptureBuilderPage />);

        await waitFor(() => expect(screen.getByText(/add a stamped code, or mark it unreadable/i)).toBeInTheDocument());
    });
});

describe("WorkerCaptureBuilderPage — photo requirement", () => {
    it("requires at least one photo before submit, even with the code present", async () => {
        getCapture.mockResolvedValue(baseCapture({ catalysts: [catalyst({ photos: [] })] }));
        render(<WorkerCaptureBuilderPage />);

        await waitFor(() => screen.getByText("Catalysts (1)"));
        expect(screen.getByText(/at least 1 required/i)).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: /submit for review/i }));
        await waitFor(() => expect(submitCapture).not.toHaveBeenCalled());
        expect(screen.getByText(/finish every catalyst/i)).toBeInTheDocument();
    });

    it("requires a photo even when code_unreadable is true", async () => {
        getCapture.mockResolvedValue(baseCapture({ catalysts: [catalyst({ physical_code_raw: "", code_unreadable: true, photos: [] })] }));
        render(<WorkerCaptureBuilderPage />);

        await waitFor(() => screen.getByText("Catalysts (1)"));
        fireEvent.click(screen.getByRole("button", { name: /submit for review/i }));
        await waitFor(() => expect(submitCapture).not.toHaveBeenCalled());
    });

    it("allows submit once every catalyst has a photo", async () => {
        getCapture.mockResolvedValue(baseCapture({ catalysts: [catalyst({ photos: [{ id: 100, view_url: "https://x/1" }] })] }));
        submitCapture.mockResolvedValue(baseCapture({ status: "PENDING_REVIEW" }));
        render(<WorkerCaptureBuilderPage />);

        await waitFor(() => screen.getByText("Catalysts (1)"));
        fireEvent.click(screen.getByRole("button", { name: /submit for review/i }));

        // Final review modal appears instead of calling submit immediately.
        expect(await screen.findByRole("dialog", { name: /review before submitting/i })).toBeInTheDocument();
        expect(submitCapture).not.toHaveBeenCalled();
    });
});

describe("WorkerCaptureBuilderPage — photo upload", () => {
    it("uploads a photo successfully and shows it after refresh", async () => {
        getCapture
            .mockResolvedValueOnce(baseCapture({ catalysts: [catalyst({ photos: [] })] }))
            .mockResolvedValueOnce(baseCapture({ catalysts: [catalyst({ photos: [{ id: 200, view_url: "https://r2/new.jpg", original_filename: "a.jpg" }] })] }));
        uploadCatalystPhoto.mockResolvedValue(200);
        render(<WorkerCaptureBuilderPage />);

        await waitFor(() => screen.getByText("Catalysts (1)"));
        const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
        const fileInputs = document.querySelectorAll('input[type="file"]');
        fireEvent.change(fileInputs[1], { target: { files: [file] } }); // gallery input (multiple)

        await waitFor(() => expect(uploadCatalystPhoto).toHaveBeenCalled());
        await waitFor(() => expect(getCapture).toHaveBeenCalledTimes(2));
    });

    it("shows a retry control when upload fails, and retrying succeeds", async () => {
        getCapture.mockResolvedValue(baseCapture({ catalysts: [catalyst({ photos: [] })] }));
        uploadCatalystPhoto.mockRejectedValueOnce(new CatalyticApiError("Upload failed")).mockResolvedValueOnce(300);
        render(<WorkerCaptureBuilderPage />);

        await waitFor(() => screen.getByText("Catalysts (1)"));
        const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
        const fileInputs = document.querySelectorAll('input[type="file"]');
        fireEvent.change(fileInputs[1], { target: { files: [file] } });

        const retryButton = await screen.findByRole("button", { name: /retry/i });
        expect(retryButton).toBeInTheDocument();

        fireEvent.click(retryButton);
        await waitFor(() => expect(uploadCatalystPhoto).toHaveBeenCalledTimes(2));
    });

    it("deletes a server-confirmed photo", async () => {
        getCapture.mockResolvedValue(baseCapture({ catalysts: [catalyst({ photos: [{ id: 500, view_url: "https://x/1", original_filename: "a.jpg" }] })] }));
        deletePhoto.mockResolvedValue();
        render(<WorkerCaptureBuilderPage />);

        await waitFor(() => screen.getByText("Catalysts (1)"));
        fireEvent.click(screen.getByLabelText(/delete photo/i));

        await waitFor(() => expect(deletePhoto).toHaveBeenCalledWith("1", 10, 500));
    });
});

describe("WorkerCaptureBuilderPage — submit → read-only PENDING_REVIEW", () => {
    it("submits via the review modal and shows the pending state", async () => {
        const ready = baseCapture({ catalysts: [catalyst({ photos: [{ id: 1, view_url: "https://x/1" }] })] });
        getCapture.mockResolvedValueOnce(ready).mockResolvedValueOnce(baseCapture({ status: "PENDING_REVIEW", catalysts: ready.catalysts, submitted_at: "2026-01-01T00:00:00Z" }));
        submitCapture.mockResolvedValue({});
        render(<WorkerCaptureBuilderPage />);

        await waitFor(() => screen.getByText("Catalysts (1)"));
        fireEvent.click(screen.getByRole("button", { name: /submit for review/i }));
        const dialog = await screen.findByRole("dialog");
        fireEvent.click(within(dialog).getByRole("button", { name: /submit for review/i }));

        await waitFor(() => expect(submitCapture).toHaveBeenCalledWith("1"));
        await waitFor(() => expect(screen.getByText(/nothing left to do here/i)).toBeInTheDocument());
        // No editable controls once PENDING_REVIEW.
        expect(screen.queryByRole("button", { name: /add another catalyst/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /delete draft/i })).not.toBeInTheDocument();
    });
});

describe("WorkerCaptureBuilderPage — rejected / reopen", () => {
    it("shows the moderator's rejection reason prominently", async () => {
        getCapture.mockResolvedValue(baseCapture({ status: "REJECTED", moderator_notes: "Photo too blurry to read the stamp", catalysts: [catalyst()] }));
        render(<WorkerCaptureBuilderPage />);

        await waitFor(() => expect(screen.getByText(/photo too blurry to read the stamp/i)).toBeInTheDocument());
        expect(screen.getByText(/rejected — action needed/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /fix & resubmit/i })).toBeInTheDocument();
    });

    it("reopens a rejected capture back to editable DRAFT, preserving its catalysts", async () => {
        getCapture
            .mockResolvedValueOnce(baseCapture({ status: "REJECTED", moderator_notes: "fix it", catalysts: [catalyst()] }))
            .mockResolvedValueOnce(baseCapture({ status: "DRAFT", catalysts: [catalyst()] }));
        reopenCapture.mockResolvedValue({});
        render(<WorkerCaptureBuilderPage />);

        await waitFor(() => screen.getByRole("button", { name: /fix & resubmit/i }));
        fireEvent.click(screen.getByRole("button", { name: /fix & resubmit/i }));

        await waitFor(() => expect(reopenCapture).toHaveBeenCalledWith("1"));
        await waitFor(() => expect(screen.getByText("ABC123")).toBeInTheDocument());
        await waitFor(() => expect(screen.getByRole("button", { name: /add another catalyst/i })).toBeInTheDocument());
    });
});

describe("WorkerCaptureBuilderPage — approved", () => {
    it("is read-only with no editing controls", async () => {
        getCapture.mockResolvedValue(baseCapture({ status: "APPROVED", reviewed_at: "2026-01-01T00:00:00Z", catalysts: [catalyst()] }));
        render(<WorkerCaptureBuilderPage />);

        await waitFor(() => expect(screen.getByText(/thank you/i)).toBeInTheDocument());
        expect(screen.queryByRole("button", { name: /add another catalyst/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /delete draft/i })).not.toBeInTheDocument();
        expect(screen.queryByLabelText(/edit catalyst/i)).not.toBeInTheDocument();
        expect(screen.queryByLabelText(/delete catalyst/i)).not.toBeInTheDocument();
    });
});

describe("WorkerCaptureBuilderPage — moderator correction preserved (view only)", () => {
    it("never overwrites the worker's raw value in this UI's own display", async () => {
        getCapture.mockResolvedValue(
            baseCapture({
                status: "APPROVED",
                catalysts: [catalyst({ physical_code_raw: "TEST-GMC-O4O", final_physical_code_raw: "TEST-GMC-040" })],
            })
        );
        render(<WorkerCaptureBuilderPage />);
        // The worker-facing card always shows their own original entry —
        // normalization/correction is a moderator-side concept this UI
        // never displays as if the worker had typed it.
        await waitFor(() => expect(screen.getByText("TEST-GMC-O4O")).toBeInTheDocument());
    });
});

describe("WorkerCaptureBuilderPage — network failure retains input", () => {
    it("keeps the catalyst add form filled in after a failed add", async () => {
        getCapture.mockResolvedValue(baseCapture({ catalysts: [] }));
        addCatalyst.mockRejectedValueOnce(new CatalyticApiError("Network error"));
        render(<WorkerCaptureBuilderPage />);

        await waitFor(() => screen.getByText("Catalysts (0)"));
        fireEvent.click(screen.getByRole("button", { name: /add another catalyst/i }));
        fireEvent.change(screen.getByPlaceholderText(/stamped code/i), { target: { value: "abc123" } });
        fireEvent.click(screen.getByRole("button", { name: /add catalyst/i }));

        await waitFor(() => expect(addCatalyst).toHaveBeenCalledTimes(1));
        // Form is still open with the value the worker typed — nothing cleared.
        expect(screen.getByPlaceholderText(/stamped code/i).value).toBe("ABC123");
    });

    it("keeps an edited catalyst's fields after a failed save", async () => {
        getCapture.mockResolvedValue(baseCapture({ catalysts: [catalyst()] }));
        updateCatalyst.mockRejectedValueOnce(new CatalyticApiError("Network error"));
        render(<WorkerCaptureBuilderPage />);

        await waitFor(() => screen.getByText("Catalysts (1)"));
        fireEvent.click(screen.getByLabelText(/edit catalyst/i));
        const codeInput = screen.getByPlaceholderText(/stamped code/i);
        fireEvent.change(codeInput, { target: { value: "newcode1" } });
        fireEvent.click(screen.getByRole("button", { name: /save/i }));

        await waitFor(() => expect(updateCatalyst).toHaveBeenCalledTimes(1));
        expect(screen.getByPlaceholderText(/stamped code/i).value).toBe("NEWCODE1"); // edit form still open, value retained
    });
});

describe("WorkerCaptureBuilderPage — role / moderation controls", () => {
    it("never renders an approve or reject control anywhere on this page", async () => {
        getCapture.mockResolvedValue(baseCapture({ status: "PENDING_REVIEW", catalysts: [catalyst()] }));
        render(<WorkerCaptureBuilderPage />);

        await waitFor(() => expect(screen.getByText(/nothing left to do here/i)).toBeInTheDocument());
        expect(screen.queryByRole("button", { name: /approve/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /^reject$/i })).not.toBeInTheDocument();
    });
});
