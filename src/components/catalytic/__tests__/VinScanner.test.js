import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import VinScanner from "../VinScanner";
import * as camera from "@/lib/catalytic/vinCamera";

// Frame capture and OCR are replaced so these tests can drive what the camera "sees". The
// real engine and a real camera stream are tested elsewhere; browser mocks prove the logic
// around them, not camera hardware.
vi.mock("@/lib/catalytic/vinCamera", async () => {
    const actual = await vi.importActual("@/lib/catalytic/vinCamera");
    return {
        ...actual,
        openCamera: vi.fn(),
        listCameras: vi.fn(),
        createOcr: vi.fn(),
        createBarcodeReader: vi.fn(),
        drawToCanvas: vi.fn(),
        enhanceForOcr: vi.fn((canvas) => canvas),
        measureFrame: vi.fn(),
        loadImageFile: vi.fn(),
    };
});

const GOOD = "1GNSKCKC8HR225261";
const FAILS_CHECK = "1FTFW1EG8JFC12345";

function makeStream() {
    const track = { stop: vi.fn(), getCapabilities: () => ({}), getSettings: () => ({ deviceId: "back" }), applyConstraints: vi.fn() };
    return { track, getTracks: () => [track], getVideoTracks: () => [track] };
}

let stream;
let ocrText;
let barcodeText;
let ocr;

function setup({ onDetected = vi.fn(), onClose = vi.fn() } = {}) {
    render(<VinScanner onDetected={onDetected} onClose={onClose} />);
    return { onDetected, onClose };
}

const live = () => screen.findByTestId("vin-video");

beforeEach(() => {
    vi.clearAllMocks();
    stream = makeStream();
    ocrText = "";
    barcodeText = null;
    ocr = { read: vi.fn(async () => ocrText), terminate: vi.fn() };
    camera.openCamera.mockResolvedValue(stream);
    camera.listCameras.mockResolvedValue([{ deviceId: "back", kind: "videoinput" }]);
    camera.createOcr.mockResolvedValue(ocr);
    camera.createBarcodeReader.mockResolvedValue({ read: () => barcodeText });
    camera.drawToCanvas.mockReturnValue({
        width: 10, height: 10,
        getContext: () => ({ getImageData: () => ({ data: new Uint8ClampedArray(400), width: 10, height: 10 }) }),
    });
    camera.measureFrame.mockReturnValue({ brightness: 150, sharpness: 80 });
    Object.defineProperty(HTMLVideoElement.prototype, "videoWidth", { configurable: true, get: () => 1920 });
    Object.defineProperty(HTMLVideoElement.prototype, "videoHeight", { configurable: true, get: () => 1080 });
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue();
});

describe("camera access", () => {
    it("opens the camera on tap and shows the guide", async () => {
        setup();
        await live();
        expect(camera.openCamera).toHaveBeenCalled();
        expect(screen.getByTestId("vin-guide")).toBeInTheDocument();
        const video = screen.getByTestId("vin-video");
        // iOS Safari refuses to play inline without these.
        expect(video.hasAttribute("playsinline")).toBe(true);
        expect(video.muted).toBe(true);
    });

    it.each([
        ["NotAllowedError", /Camera access is blocked/],
        ["NotFoundError", /No camera found/],
        ["NotReadableError", /The camera is in use/],
        ["CameraUnsupported", /can't open the camera/],
    ])("explains %s and keeps the other ways in", async (name, message) => {
        camera.openCamera.mockRejectedValue(Object.assign(new Error("x"), { name }));
        setup();
        expect(await screen.findByText(message)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Use a Photo" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Enter Manually" })).toBeInTheDocument();
    });

    it("can try the camera again after a failure", async () => {
        camera.openCamera.mockRejectedValueOnce(Object.assign(new Error("x"), { name: "NotReadableError" }));
        setup();
        fireEvent.click(await screen.findByRole("button", { name: "Try the Camera Again" }));
        await waitFor(() => expect(camera.openCamera).toHaveBeenCalledTimes(2));
    });
});

describe("the camera never keeps running", () => {
    it("stops when closed", async () => {
        const { onClose } = setup();
        await live();
        fireEvent.click(screen.getByRole("button", { name: "Close scanner" }));
        expect(stream.track.stop).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
    });

    it("stops and frees the OCR worker on unmount", async () => {
        const { unmount } = render(<VinScanner onDetected={vi.fn()} onClose={vi.fn()} />);
        await live();
        await waitFor(() => expect(camera.createOcr).toHaveBeenCalled());
        await act(async () => {});
        unmount();
        expect(stream.track.stop).toHaveBeenCalled();
        expect(ocr.terminate).toHaveBeenCalled();
    });

    it("stops if unmounted while permission is still being asked", async () => {
        let grant;
        camera.openCamera.mockReturnValue(new Promise((resolve) => { grant = resolve; }));
        const { unmount } = render(<VinScanner onDetected={vi.fn()} onClose={vi.fn()} />);
        unmount();
        await act(async () => grant(stream));
        expect(stream.track.stop).toHaveBeenCalled();
    });

    it("stops as soon as a VIN is found", async () => {
        ocrText = GOOD;
        setup();
        await screen.findByTestId("vin-confirm");
        expect(stream.track.stop).toHaveBeenCalled();
    });

    it("stops when the page is hidden, and comes back when it returns", async () => {
        setup();
        await live();
        Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
        document.dispatchEvent(new Event("visibilitychange"));
        expect(stream.track.stop).toHaveBeenCalled();
        Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
        document.dispatchEvent(new Event("visibilitychange"));
        await waitFor(() => expect(camera.openCamera).toHaveBeenCalledTimes(2));
        delete document.hidden;
    });
});

describe("confirming a reading", () => {
    it("never uses a VIN by itself", async () => {
        ocrText = GOOD;
        const { onDetected } = setup();
        await screen.findByTestId("vin-confirm");
        expect(screen.getByText("VIN detected")).toBeInTheDocument();
        expect(screen.getByLabelText("Detected VIN")).toHaveValue(GOOD);
        expect(onDetected).not.toHaveBeenCalled();
    });

    it("uses it on Use This VIN", async () => {
        ocrText = GOOD;
        const { onDetected } = setup();
        fireEvent.click(await screen.findByRole("button", { name: "Use This VIN" }));
        expect(onDetected).toHaveBeenCalledWith(GOOD);
    });

    it("lets the worker correct a character, and validates it", async () => {
        ocrText = GOOD;
        const { onDetected } = setup();
        const input = await screen.findByLabelText("Detected VIN");
        fireEvent.change(input, { target: { value: "1GNSKCKC8HR22526I" } });
        expect(screen.getByRole("alert")).toHaveTextContent(/never contains I, O or Q/);
        expect(screen.getByRole("button", { name: "Use This VIN" })).toBeDisabled();
        fireEvent.change(input, { target: { value: FAILS_CHECK.toLowerCase() } });
        expect(screen.getByRole("button", { name: "Use This VIN" })).toBeEnabled();
        expect(screen.getByText(/fails the standard check digit/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Use This VIN" }));
        expect(onDetected).toHaveBeenCalledWith(FAILS_CHECK);
    });

    it("scans again from the start", async () => {
        ocrText = GOOD;
        setup();
        fireEvent.click(await screen.findByRole("button", { name: "Scan Again" }));
        await waitFor(() => expect(camera.openCamera).toHaveBeenCalledTimes(2));
        ocrText = "";
    });

    it("makes the worker choose when the reading is uncertain", async () => {
        // Fails the check digit, so look-alike repairs are offered next to the literal reading.
        ocrText = FAILS_CHECK;
        const { onDetected } = setup();
        expect(await screen.findByText("Several possible VINs")).toBeInTheDocument();
        expect(screen.getByLabelText("Detected VIN")).toHaveValue("");
        expect(screen.getByRole("button", { name: "Use This VIN" })).toBeDisabled();
        fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${FAILS_CHECK}`) }));
        fireEvent.click(screen.getByRole("button", { name: "Use This VIN" }));
        expect(onDetected).toHaveBeenCalledWith(FAILS_CHECK);
    });

    it("does not bother the worker with one uncertain frame", async () => {
        const unrelated = "NOTHING HERE";
        ocrText = unrelated;
        setup();
        await waitFor(() => expect(ocr.read.mock.calls.length).toBeGreaterThanOrEqual(1));
        expect(screen.queryByTestId("vin-confirm")).not.toBeInTheDocument();
    });
});

describe("what it can read", () => {
    it("reads a barcode without waiting for OCR", async () => {
        barcodeText = GOOD;
        camera.createOcr.mockReturnValue(new Promise(() => {}));
        setup();
        await screen.findByTestId("vin-confirm");
        expect(screen.getByLabelText("Detected VIN")).toHaveValue(GOOD);
    });

    it("skips a barcode that isn't a VIN", async () => {
        barcodeText = "https://example.com";
        ocrText = GOOD;
        setup();
        await screen.findByTestId("vin-confirm");
        expect(screen.getByLabelText("Detected VIN")).toHaveValue(GOOD);
    });

    it("reads a photo when the camera is unavailable", async () => {
        camera.openCamera.mockRejectedValue(Object.assign(new Error("x"), { name: "NotAllowedError" }));
        camera.loadImageFile.mockResolvedValue({ naturalWidth: 100, naturalHeight: 100 });
        setup();
        await screen.findByText(/Camera access is blocked/);
        await waitFor(() => expect(camera.createOcr).toHaveBeenCalled());
        await act(async () => {});
        ocrText = `VIN ${GOOD}`;
        fireEvent.change(screen.getByLabelText("VIN photo"), { target: { files: [new File(["x"], "v.jpg", { type: "image/jpeg" })] } });
        expect(await screen.findByLabelText("Detected VIN")).toHaveValue(GOOD);
    });

    it("says so when a photo has no VIN", async () => {
        camera.openCamera.mockRejectedValue(Object.assign(new Error("x"), { name: "NotAllowedError" }));
        camera.loadImageFile.mockResolvedValue({ naturalWidth: 100, naturalHeight: 100 });
        setup();
        await screen.findByText(/Camera access is blocked/);
        await act(async () => {});
        fireEvent.change(screen.getByLabelText("VIN photo"), { target: { files: [new File(["x"], "v.jpg", { type: "image/jpeg" })] } });
        expect(await screen.findByRole("alert")).toHaveTextContent(/No VIN found in that photo/);
    });

    it("keeps working if the text reader fails to load", async () => {
        camera.createOcr.mockRejectedValue(new Error("network"));
        setup();
        expect(await screen.findByText(/text reader could not load/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Enter Manually" })).toBeInTheDocument();
    });
});

describe("hard conditions", () => {
    it("asks for light in a dark frame, and doesn't waste OCR on it", async () => {
        camera.measureFrame.mockReturnValue({ brightness: 10, sharpness: 80 });
        setup();
        expect(await screen.findByText(/Too dark/)).toBeInTheDocument();
        await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
        expect(ocr.read).not.toHaveBeenCalled();
    });

    it("asks a blurry frame to hold steady, and still tries to read it", async () => {
        camera.measureFrame.mockReturnValue({ brightness: 150, sharpness: 5 });
        ocrText = "";
        setup();
        expect(await screen.findByText(/Hold steady/)).toBeInTheDocument();
        await waitFor(() => expect(ocr.read).toHaveBeenCalled());
    });

    it("offers a camera switch only with more than one camera", async () => {
        const { unmount } = render(<VinScanner onDetected={vi.fn()} onClose={vi.fn()} />);
        await live();
        expect(screen.queryByRole("button", { name: "Switch camera" })).not.toBeInTheDocument();
        unmount();
        camera.openCamera.mockClear();
        camera.listCameras.mockResolvedValue([{ deviceId: "back" }, { deviceId: "front" }]);
        setup();
        fireEvent.click(await screen.findByRole("button", { name: "Switch camera" }));
        await waitFor(() => expect(camera.openCamera).toHaveBeenLastCalledWith({ deviceId: "front" }));
    });

    it("offers the flash only where the camera has one", async () => {
        stream.track.getCapabilities = () => ({ torch: true });
        setup();
        fireEvent.click(await screen.findByRole("button", { name: "Turn flash on" }));
        await waitFor(() => expect(stream.track.applyConstraints).toHaveBeenCalledWith({ advanced: [{ torch: true }] }));
    });
});
