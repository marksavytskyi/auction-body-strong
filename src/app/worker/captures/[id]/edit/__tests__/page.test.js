import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import EditSubmissionPage from "../page";
import { deleteStagedPhoto, getCapture, lookupVin, resubmitCapture, uploadStagedPhoto } from "@/lib/catalytic/workerCaptures";
import { CatalyticApiError } from "@/lib/catalytic/api";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useParams: () => ({ id: "5" }), useRouter: () => ({ push }) }));
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/catalytic/workerCaptures", async () => ({
    ...(await vi.importActual("@/lib/catalytic/workerCaptures")),
    getCapture: vi.fn(), resubmitCapture: vi.fn(), uploadStagedPhoto: vi.fn(), deleteStagedPhoto: vi.fn(), lookupVin: vi.fn(),
}));

const photo = (id) => ({ id, view_url: `https://r2/${id}.jpg`, original_filename: `${id}.jpg` });
const capture = (overrides = {}) => ({
    id: 5, status: "PENDING_REVIEW", revision: 3, vin: "1GNSKCKC8HR225261", year: 2017, make: "Chevrolet", model: "Tahoe",
    engine: "5.3L", notes: "n",
    catalysts: [
        { id: 10, position_code: "front_left", physical_code_raw: "ABC1", code_unreadable: false, notes: "", photos: [photo(100)] },
        { id: 11, position_code: "rear", physical_code_raw: "", code_unreadable: true, notes: "rusty", photos: [photo(101), photo(102)] },
    ],
    ...overrides,
});

const save = () => screen.getByRole("button", { name: /Save & Resubmit for Review/ });
const sent = () => resubmitCapture.mock.calls[0][1];
const addFile = (input) => fireEvent.change(input, { target: { files: [new File(["x"], "new.jpg", { type: "image/jpeg" })] } });

async function open(data = capture()) {
    getCapture.mockResolvedValue(data);
    render(<EditSubmissionPage />);
    await screen.findByText("Edit Submission");
}

beforeEach(() => {
    vi.clearAllMocks();
    window.confirm = vi.fn(() => true);
    global.URL.createObjectURL = vi.fn(() => "blob:preview");
    global.URL.revokeObjectURL = vi.fn();
    resubmitCapture.mockResolvedValue(capture());
    deleteStagedPhoto.mockResolvedValue();
    lookupVin.mockResolvedValue({ source: "NONE", message: "x" });
});

describe("opening", () => {
    it("shows everything already saved", async () => {
        await open();
        expect(screen.getByLabelText("VIN")).toHaveValue("1GNSKCKC8HR225261");
        expect(screen.getByLabelText("Year")).toHaveValue(2017);
        expect(screen.getByLabelText("Make")).toHaveValue("Chevrolet");
        expect(screen.getByLabelText("Model")).toHaveValue("Tahoe");
        expect(screen.getByLabelText("Engine")).toHaveValue("5.3L");
        expect(screen.getByText("Catalysts (2)")).toBeInTheDocument();
        expect(screen.getByText("ABC1")).toBeInTheDocument();
        expect(screen.getByText("code unreadable")).toBeInTheDocument();
        expect(screen.getAllByRole("img")).toHaveLength(3);
    });

    it.each(["APPROVED", "CANCELLED", "REJECTED", "DRAFT"])("refuses a %s submission", async (status) => {
        getCapture.mockResolvedValue(capture({ status }));
        render(<EditSubmissionPage />);
        expect(await screen.findByRole("alert")).toHaveTextContent(/no longer pending review/);
        expect(screen.queryByRole("button", { name: /Save & Resubmit/ })).not.toBeInTheDocument();
    });

    it("shows a load failure", async () => {
        getCapture.mockRejectedValue(new CatalyticApiError("capture 5 not found"));
        render(<EditSubmissionPage />);
        expect(await screen.findByRole("alert")).toHaveTextContent("capture 5 not found");
    });
});

describe("saving", () => {
    it("sends the whole submission once, naming the revision read", async () => {
        await open();
        fireEvent.change(screen.getByLabelText("Make"), { target: { value: "GMC" } });
        fireEvent.click(save());
        await waitFor(() => expect(resubmitCapture).toHaveBeenCalledTimes(1));
        expect(resubmitCapture.mock.calls[0][0]).toBe("5");
        expect(sent()).toEqual({
            expected_revision: 3, vin: "1GNSKCKC8HR225261", year: 2017, make: "GMC", model: "Tahoe", engine: "5.3L", notes: "n",
            catalysts: [
                { id: 10, position_code: "front_left", physical_code_raw: "ABC1", code_unreadable: false, notes: "", photo_ids: [100] },
                { id: 11, position_code: "rear", physical_code_raw: "", code_unreadable: true, notes: "rusty", photo_ids: [101, 102] },
            ],
        });
        await waitFor(() => expect(push).toHaveBeenCalledWith("/worker/captures/5"));
    });

    it("edits a catalyst through the existing form", async () => {
        await open();
        fireEvent.click(screen.getAllByLabelText("Edit catalyst")[0]);
        fireEvent.change(screen.getByPlaceholderText(/stamped code/i), { target: { value: "new9" } });
        fireEvent.change(screen.getByPlaceholderText(/position/i), { target: { value: "rear left" } });
        fireEvent.click(screen.getByRole("button", { name: "Done" }));
        fireEvent.click(save());
        await waitFor(() => expect(resubmitCapture).toHaveBeenCalled());
        expect(sent().catalysts[0]).toMatchObject({ id: 10, physical_code_raw: "NEW9", position_code: "rear left" });
    });

    it("removes a catalyst", async () => {
        await open();
        fireEvent.click(screen.getAllByLabelText("Remove catalyst")[1]);
        fireEvent.click(save());
        await waitFor(() => expect(resubmitCapture).toHaveBeenCalled());
        expect(sent().catalysts.map((c) => c.id)).toEqual([10]);
    });

    it("adds a catalyst with a new photo", async () => {
        uploadStagedPhoto.mockResolvedValue(555);
        await open();
        fireEvent.click(screen.getByRole("button", { name: /Add Another Catalyst/ }));
        fireEvent.change(screen.getByPlaceholderText(/stamped code/i), { target: { value: "ZZ1" } });
        fireEvent.click(screen.getByRole("button", { name: "Add Catalyst" }));
        expect(save()).toBeDisabled();
        expect(screen.getByText("Every catalyst needs at least one photo.")).toBeInTheDocument();
        addFile(screen.getAllByLabelText("Choose photos")[2]);
        await waitFor(() => expect(save()).toBeEnabled());
        fireEvent.click(save());
        await waitFor(() => expect(resubmitCapture).toHaveBeenCalled());
        expect(sent().catalysts[2]).toMatchObject({ id: null, physical_code_raw: "ZZ1", photo_ids: [555] });
    });

    it("can't save while a photo is uploading, or with a failed one", async () => {
        let finish;
        uploadStagedPhoto.mockReturnValue(new Promise((_, reject) => { finish = reject; }));
        await open();
        addFile(screen.getAllByLabelText("Choose photos")[0]);
        await waitFor(() => expect(save()).toBeDisabled());
        expect(screen.getByText("Waiting for photos to finish uploading.")).toBeInTheDocument();
        finish(new CatalyticApiError("Upload failed"));
        expect(await screen.findByText("Retry or remove the photos that failed to upload.")).toBeInTheDocument();
        expect(save()).toBeDisabled();
    });

    it("retries a failed upload", async () => {
        uploadStagedPhoto.mockRejectedValueOnce(new CatalyticApiError("Upload failed")).mockResolvedValueOnce(556);
        await open();
        addFile(screen.getAllByLabelText("Choose photos")[0]);
        fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
        await waitFor(() => expect(save()).toBeEnabled());
        fireEvent.click(save());
        await waitFor(() => expect(resubmitCapture).toHaveBeenCalled());
        expect(sent().catalysts[0].photo_ids).toEqual([100, 556]);
    });

    it("removes and replaces photos", async () => {
        uploadStagedPhoto.mockResolvedValue(557);
        await open();
        fireEvent.click(screen.getAllByLabelText("Remove photo")[0]);
        expect(save()).toBeDisabled();
        addFile(screen.getAllByLabelText("Choose photos")[0]);
        await waitFor(() => expect(save()).toBeEnabled());
        fireEvent.click(save());
        await waitFor(() => expect(resubmitCapture).toHaveBeenCalled());
        expect(sent().catalysts[0].photo_ids).toEqual([557]);
        expect(sent().catalysts[1].photo_ids).toEqual([101, 102]);
    });

    it.each([["Make"], ["Model"], ["Year"]])("needs a %s", async (label) => {
        await open();
        fireEvent.change(screen.getByLabelText(label), { target: { value: "" } });
        expect(save()).toBeDisabled();
    });

    it("needs a valid VIN if there is one, but allows none", async () => {
        await open();
        fireEvent.change(screen.getByLabelText("VIN"), { target: { value: "SHORT" } });
        expect(save()).toBeDisabled();
        fireEvent.change(screen.getByLabelText("VIN"), { target: { value: "" } });
        expect(save()).toBeEnabled();
    });
});

describe("when the save fails", () => {
    it("keeps everything typed", async () => {
        resubmitCapture.mockRejectedValue(new CatalyticApiError("Network error"));
        await open();
        fireEvent.change(screen.getByLabelText("Make"), { target: { value: "GMC" } });
        fireEvent.click(save());
        expect(await screen.findByRole("alert")).toHaveTextContent("Network error");
        expect(screen.getByLabelText("Make")).toHaveValue("GMC");
        expect(push).not.toHaveBeenCalled();
    });

    it("explains a conflict and reloads only when asked, dropping unsaved uploads", async () => {
        uploadStagedPhoto.mockResolvedValue(558);
        resubmitCapture.mockRejectedValue(new CatalyticApiError("This submission has changed. Refresh to review the latest version.", { status: 409 }));
        await open();
        addFile(screen.getAllByLabelText("Choose photos")[0]);
        await waitFor(() => expect(save()).toBeEnabled());
        fireEvent.click(save());
        expect(await screen.findByRole("alert")).toHaveTextContent("has changed");
        expect(screen.queryByRole("button", { name: /Save & Resubmit/ })).not.toBeInTheDocument();
        getCapture.mockResolvedValue(capture({ revision: 4, make: "Latest" }));
        fireEvent.click(screen.getByRole("button", { name: "Reload the Latest Version" }));
        await waitFor(() => expect(screen.getByLabelText("Make")).toHaveValue("Latest"));
        expect(deleteStagedPhoto).toHaveBeenCalledWith("5", 558);
    });
});

describe("leaving", () => {
    it("discards uploads and saves nothing", async () => {
        uploadStagedPhoto.mockResolvedValue(559);
        await open();
        addFile(screen.getAllByLabelText("Choose photos")[0]);
        await waitFor(() => expect(save()).toBeEnabled());
        fireEvent.click(screen.getByRole("button", { name: /Discard changes/ }));
        expect(deleteStagedPhoto).toHaveBeenCalledWith("5", 559);
        expect(resubmitCapture).not.toHaveBeenCalled();
        expect(push).toHaveBeenCalledWith("/worker/captures/5");
    });
});
