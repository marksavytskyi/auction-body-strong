// Everything between the camera and text. The OCR and barcode libraries load only when the
// scanner opens, so no other screen pays for them.

const OCR_ASSETS = "/vin-ocr";
const MIN_BRIGHTNESS = 45;
const MIN_EDGE_STRENGTH = 28;
const OCR_MAX_WIDTH = 1600;

export const CAMERA_ERROR = {
    DENIED: "DENIED",
    NO_CAMERA: "NO_CAMERA",
    BUSY: "BUSY",
    UNSUPPORTED: "UNSUPPORTED",
    FAILED: "FAILED",
};

export function classifyCameraError(error) {
    switch (error?.name) {
        case "NotAllowedError":
        case "SecurityError":
            return CAMERA_ERROR.DENIED;
        case "NotFoundError":
        case "OverconstrainedError":
        case "DevicesNotFoundError":
            return CAMERA_ERROR.NO_CAMERA;
        case "NotReadableError":
        case "TrackStartError":
        case "AbortError":
            return CAMERA_ERROR.BUSY;
        default:
            return CAMERA_ERROR.FAILED;
    }
}

export async function openCamera({ deviceId } = {}) {
    if (!navigator.mediaDevices?.getUserMedia) {
        const error = new Error("camera API unavailable");
        error.name = "CameraUnsupported";
        throw error;
    }
    const size = { width: { ideal: 1920 }, height: { ideal: 1080 } };
    const video = deviceId ? { deviceId: { exact: deviceId }, ...size } : { facingMode: { ideal: "environment" }, ...size };
    return navigator.mediaDevices.getUserMedia({ video, audio: false });
}

export function stopStream(stream) {
    stream?.getTracks().forEach((track) => track.stop());
}

export async function listCameras() {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === "videoinput");
}

// Which part of the video sits under the on-screen guide, given object-fit: cover.
export function guideToVideoRect({ videoWidth, videoHeight, viewWidth, viewHeight, guide }) {
    const scale = Math.max(viewWidth / videoWidth, viewHeight / videoHeight);
    const offsetX = (videoWidth * scale - viewWidth) / 2;
    const offsetY = (videoHeight * scale - viewHeight) / 2;
    const x = Math.max(0, (guide.x + offsetX) / scale);
    const y = Math.max(0, (guide.y + offsetY) / scale);
    return {
        x,
        y,
        width: Math.min(videoWidth - x, guide.width / scale),
        height: Math.min(videoHeight - y, guide.height / scale),
    };
}

// Average brightness, and how strong the frame's strongest edges are. A label is mostly
// blank, so an average would call sharp text blurry: only the top edges say anything.
export function measureFrame({ data, width, height }) {
    let brightness = 0;
    let samples = 0;
    const edges = new Uint32Array(256);
    const luma = (i) => 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const step = Math.max(1, Math.floor(Math.min(width, height) / 240));
    for (let y = 0; y < height; y += step) {
        for (let x = 0; x + step < width; x += step) {
            const i = (y * width + x) * 4;
            const value = luma(i);
            brightness += value;
            edges[Math.min(255, Math.round(Math.abs(value - luma(i + step * 4))))] += 1;
            samples += 1;
        }
    }
    let remaining = samples * 0.01;
    let sharpness = 255;
    while (sharpness > 0 && remaining > 0) {
        remaining -= edges[sharpness];
        sharpness -= 1;
    }
    return { brightness: samples ? brightness / samples : 0, sharpness };
}

export function frameProblem({ brightness, sharpness }) {
    if (brightness < MIN_BRIGHTNESS) return "DARK";
    if (sharpness < MIN_EDGE_STRENGTH) return "BLURRY";
    return null;
}

// Grayscale with the contrast stretched, which is what lifts text off a faded door sticker.
export function enhanceForOcr(canvas) {
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    const { data } = image;
    let low = 255;
    let high = 0;
    for (let i = 0; i < data.length; i += 4) {
        const value = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        data[i] = value;
        if (value < low) low = value;
        if (value > high) high = value;
    }
    const range = Math.max(1, high - low);
    for (let i = 0; i < data.length; i += 4) {
        const value = ((data[i] - low) * 255) / range;
        data[i] = value;
        data[i + 1] = value;
        data[i + 2] = value;
    }
    context.putImageData(image, 0, 0);
    return canvas;
}

export function drawToCanvas(source, sourceRect, maxWidth = OCR_MAX_WIDTH) {
    const scale = Math.min(maxWidth / sourceRect.width, Math.max(1, 900 / sourceRect.width));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(sourceRect.width * scale);
    canvas.height = Math.round(sourceRect.height * scale);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(source, sourceRect.x, sourceRect.y, sourceRect.width, sourceRect.height, 0, 0, canvas.width, canvas.height);
    return canvas;
}

export async function createOcr() {
    const { createWorker, PSM } = await import("tesseract.js");
    const worker = await createWorker("eng", 1, {
        workerPath: `${OCR_ASSETS}/worker.min.js`,
        corePath: OCR_ASSETS,
        langPath: OCR_ASSETS,
        workerBlobURL: false,
    });
    // AUTO read 9 of 10 test labels where SPARSE_TEXT read 3. No character whitelist: it
    // turns a "VIN:" label into characters that look like part of the VIN.
    await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
    return {
        async read(canvas) {
            const { data } = await worker.recognize(canvas);
            return data.text;
        },
        terminate: () => worker.terminate(),
    };
}

export async function createBarcodeReader() {
    const zxing = await import("@zxing/library");
    const { BarcodeFormat, BinaryBitmap, DecodeHintType, HTMLCanvasElementLuminanceSource, HybridBinarizer, MultiFormatReader } = zxing;
    const reader = new MultiFormatReader();
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.CODE_39, BarcodeFormat.CODE_128, BarcodeFormat.DATA_MATRIX, BarcodeFormat.QR_CODE, BarcodeFormat.PDF_417,
    ]);
    hints.set(DecodeHintType.TRY_HARDER, true);
    reader.setHints(hints);
    return {
        read(canvas) {
            try {
                const bitmap = new BinaryBitmap(new HybridBinarizer(new HTMLCanvasElementLuminanceSource(canvas)));
                return reader.decodeWithState(bitmap).getText();
            } catch {
                return null; // no barcode in this frame, which is the usual answer
            }
        },
    };
}

export function loadImageFile(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => {
            URL.revokeObjectURL(url);
            resolve(image);
        };
        image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("That image could not be opened."));
        };
        image.src = url;
    });
}
