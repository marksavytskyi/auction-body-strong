import { afterEach, describe, expect, it, vi } from "vitest";

import { CAMERA_ERROR, classifyCameraError, frameProblem, guideToVideoRect, listCameras, measureFrame, openCamera, stopStream } from "../vinCamera";

const original = navigator.mediaDevices;
const setDevices = (value) => Object.defineProperty(navigator, "mediaDevices", { value, configurable: true });

afterEach(() => setDevices(original));

describe("classifyCameraError", () => {
    it.each([
        ["NotAllowedError", CAMERA_ERROR.DENIED],
        ["SecurityError", CAMERA_ERROR.DENIED],
        ["NotFoundError", CAMERA_ERROR.NO_CAMERA],
        ["OverconstrainedError", CAMERA_ERROR.NO_CAMERA],
        ["NotReadableError", CAMERA_ERROR.BUSY],
        ["AbortError", CAMERA_ERROR.BUSY],
        ["Anything", CAMERA_ERROR.FAILED],
    ])("%s", (name, expected) => expect(classifyCameraError({ name })).toBe(expected));
});

describe("openCamera", () => {
    it("asks for the rear camera, as a preference so a laptop still works, and no microphone", async () => {
        const getUserMedia = vi.fn().mockResolvedValue("stream");
        setDevices({ getUserMedia });
        await expect(openCamera()).resolves.toBe("stream");
        const constraints = getUserMedia.mock.calls[0][0];
        expect(constraints.audio).toBe(false);
        expect(constraints.video.facingMode).toEqual({ ideal: "environment" });
    });

    it("asks for a specific camera when switching", async () => {
        const getUserMedia = vi.fn().mockResolvedValue("stream");
        setDevices({ getUserMedia });
        await openCamera({ deviceId: "back-2" });
        expect(getUserMedia.mock.calls[0][0].video.deviceId).toEqual({ exact: "back-2" });
    });

    it("says so when the browser has no camera API", async () => {
        setDevices(undefined);
        await expect(openCamera()).rejects.toMatchObject({ name: "CameraUnsupported" });
    });
});

describe("stopStream", () => {
    it("stops every track", () => {
        const tracks = [{ stop: vi.fn() }, { stop: vi.fn() }];
        stopStream({ getTracks: () => tracks });
        tracks.forEach((t) => expect(t.stop).toHaveBeenCalled());
    });

    it("tolerates no stream", () => {
        expect(() => stopStream(null)).not.toThrow();
    });
});

describe("listCameras", () => {
    it("keeps only video inputs", async () => {
        setDevices({ enumerateDevices: async () => [{ kind: "videoinput", deviceId: "a" }, { kind: "audioinput", deviceId: "b" }] });
        await expect(listCameras()).resolves.toEqual([{ kind: "videoinput", deviceId: "a" }]);
    });
});

describe("guideToVideoRect", () => {
    it("maps a guide through object-fit: cover on a portrait screen and landscape video", () => {
        const rect = guideToVideoRect({ videoWidth: 1920, videoHeight: 1080, viewWidth: 390, viewHeight: 700, guide: { x: 16, y: 302, width: 358, height: 96 } });
        expect(rect.height).toBeCloseTo((96 * 1080) / 700, 0);
        expect(rect.y).toBeCloseTo((302 * 1080) / 700, 0);
        // Centred: the crop sits in the middle of the video.
        expect(rect.x + rect.width / 2).toBeCloseTo(960, 0);
    });

    it("stays inside the video", () => {
        const rect = guideToVideoRect({ videoWidth: 640, videoHeight: 480, viewWidth: 640, viewHeight: 480, guide: { x: 0, y: 400, width: 640, height: 200 } });
        expect(rect.y + rect.height).toBeLessThanOrEqual(480);
    });
});

describe("measureFrame and frameProblem", () => {
    const image = (width, height, paint) => {
        const data = new Uint8ClampedArray(width * height * 4);
        for (let y = 0; y < height; y += 1) {
            for (let x = 0; x < width; x += 1) {
                const value = paint(x, y);
                data.set([value, value, value, 255], (y * width + x) * 4);
            }
        }
        return { data, width, height };
    };

    it("calls a dark frame dark", () => {
        expect(frameProblem(measureFrame(image(200, 60, () => 10)))).toBe("DARK");
    });

    it("calls an edgeless frame blurry", () => {
        expect(frameProblem(measureFrame(image(200, 60, () => 180)))).toBe("BLURRY");
    });

    it("does not call a mostly blank label with sharp text blurry", () => {
        const label = image(400, 120, (x, y) => (y > 50 && y < 70 && x % 12 < 3 ? 20 : 240));
        expect(frameProblem(measureFrame(label))).toBeNull();
    });
});
