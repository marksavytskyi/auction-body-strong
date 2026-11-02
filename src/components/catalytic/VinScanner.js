"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Flashlight, ImagePlus, Keyboard, Loader2, RefreshCw, ScanLine, SwitchCamera, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    CHECK_DIGIT_WARNING,
    createVinConsensus,
    extractVinCandidates,
    extractVinFromBarcode,
    isConfidentReading,
    validateVin,
} from "@/lib/catalytic/vin";
import {
    CAMERA_ERROR,
    classifyCameraError,
    createBarcodeReader,
    createOcr,
    drawToCanvas,
    enhanceForOcr,
    frameProblem,
    guideToVideoRect,
    listCameras,
    loadImageFile,
    measureFrame,
    openCamera,
    stopStream,
} from "@/lib/catalytic/vinCamera";

const FRAME_PAUSE_MS = 250;
const HELP_AFTER_MS = 15000;
const PHOTO_MAX_WIDTH = 2200;

const CAMERA_MESSAGE = {
    [CAMERA_ERROR.DENIED]: {
        title: "Camera access is blocked",
        body: "Allow the camera in Settings, then Safari, then Camera, and reload this page. You can also use a photo or type the VIN.",
    },
    [CAMERA_ERROR.NO_CAMERA]: { title: "No camera found", body: "Use a photo or type the VIN." },
    [CAMERA_ERROR.BUSY]: { title: "The camera is in use", body: "Close other apps using the camera and try again, or use a photo." },
    [CAMERA_ERROR.UNSUPPORTED]: {
        title: "This browser can't open the camera",
        body: "Open this page in Safari or Chrome, or use a photo or type the VIN.",
    },
    [CAMERA_ERROR.FAILED]: { title: "The camera could not start", body: "Try again, use a photo or type the VIN." },
};

// Confirmation is always a person's decision: nothing read from a camera reaches the form
// until the worker taps Use This VIN.
function ConfirmVin({ candidates, onUse, onScanAgain, onManual }) {
    const certain = isConfidentReading(candidates[0]) || candidates.length === 1;
    const [value, setValue] = useState(certain ? candidates[0]?.vin || "" : "");
    const check = validateVin(value);
    return (
        <div className="flex-1 overflow-y-auto p-4 space-y-4" data-testid="vin-confirm">
            <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                    {certain ? "VIN detected" : "Several possible VINs"}
                </div>
                <p className="mt-1 text-xs text-white/50">
                    {certain
                        ? "Check it against the vehicle. Correct any character before using it."
                        : "The reading wasn't certain. Choose the one matching the vehicle, or type it."}
                </p>
            </div>
            <Input
                aria-label="Detected VIN"
                value={value}
                onChange={(e) => setValue(e.target.value.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                className="h-14 rounded-xl bg-white/5 border-white/10 font-mono text-base tracking-wide uppercase"
            />
            {value && check.errors.map((error) => (
                <p key={error} role="alert" className="text-xs text-rose-300">{error}</p>
            ))}
            {check.valid && !check.checkDigitOk && <p className="text-xs text-amber-300">{CHECK_DIGIT_WARNING}</p>}
            {candidates.length > 1 && (
                <div className="space-y-1.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-white/40">Possible readings</div>
                    {candidates.map((candidate) => (
                        <button
                            key={candidate.vin}
                            type="button"
                            onClick={() => setValue(candidate.vin)}
                            aria-pressed={value === candidate.vin}
                            className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border px-3 text-left font-mono text-sm ${value === candidate.vin ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200" : "border-white/10 text-white/70"}`}
                        >
                            <span className="break-all">{candidate.vin}</span>
                            <span className="shrink-0 font-sans text-[10px] text-white/40">{candidate.checkDigitOk ? "check OK" : "check failed"}</span>
                        </button>
                    ))}
                </div>
            )}
            <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" className="h-14 rounded-2xl border-white/15" onClick={onScanAgain}>
                    <RefreshCw className="mr-1.5 h-4 w-4" /> Scan Again
                </Button>
                <Button type="button" className="h-14 rounded-2xl" disabled={!check.valid} onClick={() => onUse(check.vin)}>
                    Use This VIN
                </Button>
            </div>
            <button type="button" onClick={onManual} className="min-h-11 w-full text-center text-xs text-white/50 underline">
                Enter manually instead
            </button>
        </div>
    );
}

export default function VinScanner({ onDetected, onClose }) {
    const videoRef = useRef(null);
    const guideRef = useRef(null);
    const photoInputRef = useRef(null);
    const streamRef = useRef(null);
    const ocrRef = useRef(null);
    const barcodeRef = useRef(null);
    const scanningRef = useRef(false);
    const consensusRef = useRef(createVinConsensus());
    const mountedRef = useRef(true);
    const resumeOnReturnRef = useRef(false);
    const selectedDeviceRef = useRef(null);

    const [phase, setPhase] = useState("starting"); // starting | scanning | confirm | camera-error | reading-photo
    const [cameraError, setCameraError] = useState(null);
    const [candidates, setCandidates] = useState([]);
    const [hint, setHint] = useState("");
    const [readerReady, setReaderReady] = useState(false);
    const [readerFailed, setReaderFailed] = useState(false);
    const [cameras, setCameras] = useState([]);
    const [deviceId, setDeviceId] = useState(null);
    const [torchAvailable, setTorchAvailable] = useState(false);
    const [torchOn, setTorchOn] = useState(false);
    const [photoError, setPhotoError] = useState("");

    const releaseCamera = useCallback(() => {
        scanningRef.current = false;
        stopStream(streamRef.current);
        streamRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
        setTorchAvailable(false);
        setTorchOn(false);
    }, []);

    const showCandidates = useCallback((found) => {
        releaseCamera();
        setCandidates(found);
        setPhase("confirm");
    }, [releaseCamera]);

    const scanLoop = useCallback(async () => {
        const startedAt = Date.now();
        while (scanningRef.current && mountedRef.current) {
            const video = videoRef.current;
            const guide = guideRef.current;
            if (!video || !guide || !video.videoWidth) {
                await new Promise((resolve) => setTimeout(resolve, 100));
                continue;
            }
            const guideBox = guide.getBoundingClientRect();
            const videoBox = video.getBoundingClientRect();
            const rect = guideToVideoRect({
                videoWidth: video.videoWidth,
                videoHeight: video.videoHeight,
                viewWidth: videoBox.width,
                viewHeight: videoBox.height,
                guide: { x: guideBox.left - videoBox.left, y: guideBox.top - videoBox.top, width: guideBox.width, height: guideBox.height },
            });
            // Across the frame's whole width, and a little above and below it: aim is never perfect.
            const margin = rect.height * 0.25;
            const top = Math.max(0, rect.y - margin);
            const frame = drawToCanvas(video, {
                x: 0, y: top, width: video.videoWidth, height: Math.min(video.videoHeight - top, rect.height + margin * 2),
            });
            const context = frame.getContext("2d", { willReadFrequently: true });
            const problem = frameProblem(measureFrame(context.getImageData(0, 0, frame.width, frame.height)));
            setHint(problem === "DARK" ? "Too dark. Add light or turn on the flash." : problem === "BLURRY" ? "Hold steady, about a hand's length from the VIN." : Date.now() - startedAt > HELP_AFTER_MS ? "Having trouble? Try a photo, or enter it manually." : "");

            const barcodeText = barcodeRef.current?.read(frame);
            const fromBarcode = barcodeText ? extractVinFromBarcode(barcodeText) : null;
            if (fromBarcode) {
                consensusRef.current.add([fromBarcode]);
            } else if (problem !== "DARK" && ocrRef.current) {
                const text = await ocrRef.current.read(enhanceForOcr(frame)).catch(() => "");
                if (!scanningRef.current) return;
                consensusRef.current.add(extractVinCandidates(text));
            }
            const ready = consensusRef.current.ready();
            if (ready.length) {
                showCandidates(ready);
                return;
            }
            await new Promise((resolve) => setTimeout(resolve, FRAME_PAUSE_MS));
        }
    }, [showCandidates]);

    const startCamera = useCallback(async (selectedDevice) => {
        releaseCamera();
        selectedDeviceRef.current = selectedDevice || null;
        consensusRef.current.reset();
        setPhase("starting");
        setCameraError(null);
        setHint("");
        try {
            const stream = await openCamera({ deviceId: selectedDevice || undefined });
            if (!mountedRef.current) {
                stopStream(stream);
                return;
            }
            streamRef.current = stream;
            const video = videoRef.current;
            video.srcObject = stream;
            await video.play().catch(() => {});
            setPhase("scanning");
            scanningRef.current = true;
            scanLoop();
            const track = stream.getVideoTracks()[0];
            setTorchAvailable(Boolean(track?.getCapabilities?.().torch));
            listCameras().then((found) => mountedRef.current && setCameras(found)).catch(() => {});
        } catch (error) {
            if (!mountedRef.current) return;
            setCameraError(error?.name === "CameraUnsupported" ? CAMERA_ERROR.UNSUPPORTED : classifyCameraError(error));
            setPhase("camera-error");
        }
    }, [releaseCamera, scanLoop]);

    useEffect(() => {
        mountedRef.current = true;
        startCamera();
        createBarcodeReader().then((reader) => { barcodeRef.current = reader; }).catch(() => {});
        createOcr()
            .then((ocr) => {
                if (!mountedRef.current) {
                    ocr.terminate();
                    return;
                }
                ocrRef.current = ocr;
                setReaderReady(true);
            })
            .catch(() => mountedRef.current && setReaderFailed(true));

        // The camera never runs behind the worker's back: it stops when the page is hidden
        // and comes back only if the scanner was still looking for a VIN.
        const onVisibility = () => {
            if (document.hidden) {
                resumeOnReturnRef.current = scanningRef.current;
                releaseCamera();
            } else if (resumeOnReturnRef.current) {
                resumeOnReturnRef.current = false;
                startCamera(selectedDeviceRef.current);
            }
        };
        document.addEventListener("visibilitychange", onVisibility);
        window.addEventListener("pagehide", releaseCamera);
        return () => {
            mountedRef.current = false;
            document.removeEventListener("visibilitychange", onVisibility);
            window.removeEventListener("pagehide", releaseCamera);
            releaseCamera();
            ocrRef.current?.terminate();
            ocrRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const switchCamera = () => {
        const current = streamRef.current?.getVideoTracks()[0]?.getSettings?.().deviceId || deviceId;
        const index = cameras.findIndex((c) => c.deviceId === current);
        const next = cameras[(index + 1) % cameras.length]?.deviceId;
        setDeviceId(next);
        startCamera(next);
    };

    const toggleTorch = async () => {
        const track = streamRef.current?.getVideoTracks()[0];
        try {
            await track?.applyConstraints({ advanced: [{ torch: !torchOn }] });
            setTorchOn(!torchOn);
        } catch {
            setTorchAvailable(false);
        }
    };

    const readPhoto = async (file) => {
        if (!file) return;
        releaseCamera();
        setPhotoError("");
        setPhase("reading-photo");
        try {
            const image = await loadImageFile(file);
            const canvas = drawToCanvas(image, { x: 0, y: 0, width: image.naturalWidth, height: image.naturalHeight }, PHOTO_MAX_WIDTH);
            const barcodeText = barcodeRef.current?.read(canvas);
            const fromBarcode = barcodeText ? extractVinFromBarcode(barcodeText) : null;
            if (fromBarcode) {
                showCandidates([fromBarcode]);
                return;
            }
            if (!ocrRef.current) throw new Error("The VIN reader isn't ready yet. Try again in a moment.");
            const text = await ocrRef.current.read(enhanceForOcr(canvas));
            const found = extractVinCandidates(text);
            if (!found.length) throw new Error("No VIN found in that photo. Fill the frame with the VIN and try again, or enter it manually.");
            showCandidates(found.slice(0, 4));
        } catch (error) {
            setPhotoError(error.message);
            setCameraError(null);
            setPhase("camera-error");
        }
    };

    const close = () => {
        releaseCamera();
        onClose();
    };

    const message = cameraError ? CAMERA_MESSAGE[cameraError] : null;
    const showVideo = phase === "starting" || phase === "scanning";

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label="Scan VIN"
            className="fixed inset-0 z-50 flex flex-col bg-black text-white"
            style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
        >
            <div className="flex min-h-14 items-center justify-between gap-2 px-3">
                <div className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-wide">
                    <ScanLine className="h-4 w-4 text-emerald-400" /> Scan VIN
                </div>
                <button type="button" aria-label="Close scanner" onClick={close} className="flex h-11 w-11 items-center justify-center rounded-xl text-white/70">
                    <X className="h-5 w-5" />
                </button>
            </div>

            {phase === "confirm" ? (
                <ConfirmVin
                    candidates={candidates}
                    onUse={(vin) => {
                        releaseCamera();
                        onDetected(vin);
                    }}
                    onScanAgain={() => startCamera(deviceId)}
                    onManual={close}
                />
            ) : phase === "reading-photo" ? (
                <div className="flex flex-1 items-center justify-center gap-2 text-sm text-white/70">
                    <Loader2 className="h-5 w-5 animate-spin" /> Reading the photo…
                </div>
            ) : phase === "camera-error" ? (
                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                    <CameraOff className="h-8 w-8 text-white/40" />
                    <h2 className="text-lg font-black">{photoError ? "Could not read that photo" : message?.title}</h2>
                    <p role="alert" className="text-sm text-white/60">{photoError || message?.body}</p>
                    {!photoError && cameraError !== CAMERA_ERROR.UNSUPPORTED && (
                        <Button type="button" variant="outline" className="h-12 w-full rounded-2xl border-white/15" onClick={() => startCamera(deviceId)}>
                            <Camera className="mr-1.5 h-4 w-4" /> Try the Camera Again
                        </Button>
                    )}
                </div>
            ) : null}

            <div className={showVideo ? "relative min-h-0 flex-1 overflow-hidden" : "hidden"}>
                <video ref={videoRef} playsInline muted autoPlay className="h-full w-full object-cover" data-testid="vin-video" />
                <div className="pointer-events-none absolute inset-0">
                    <div ref={guideRef} data-testid="vin-guide" className="absolute left-4 right-4 top-1/2 mx-auto h-24 max-w-xl -translate-y-1/2 rounded-xl border-2 border-emerald-400 shadow-[0_0_0_100vmax_rgba(0,0,0,0.55)]" />
                    <div className="absolute inset-x-4 top-1/2 mt-14 flex flex-col items-center gap-2 text-center">
                        <p className="text-xs font-bold text-white">Line up the VIN or its barcode inside the frame</p>
                        {hint && <p role="status" className="rounded-lg bg-black/70 px-3 py-1.5 text-xs text-amber-200">{hint}</p>}
                        {!readerReady && !readerFailed && (
                            <p className="inline-flex items-center gap-1.5 rounded-lg bg-black/70 px-3 py-1.5 text-xs text-white/70">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading the text reader…
                            </p>
                        )}
                        {readerFailed && (
                            <p role="alert" className="rounded-lg bg-black/70 px-3 py-1.5 text-xs text-rose-300">
                                The text reader could not load. Barcodes still scan, or enter the VIN manually.
                            </p>
                        )}
                    </div>
                </div>
                <div className="absolute right-3 top-3 flex flex-col gap-2">
                    {torchAvailable && (
                        <button type="button" aria-label={torchOn ? "Turn flash off" : "Turn flash on"} aria-pressed={torchOn} onClick={toggleTorch} className="flex h-11 w-11 items-center justify-center rounded-xl bg-black/60">
                            <Flashlight className={`h-5 w-5 ${torchOn ? "text-amber-300" : "text-white"}`} />
                        </button>
                    )}
                    {cameras.length > 1 && (
                        <button type="button" aria-label="Switch camera" onClick={switchCamera} className="flex h-11 w-11 items-center justify-center rounded-xl bg-black/60">
                            <SwitchCamera className="h-5 w-5" />
                        </button>
                    )}
                </div>
            </div>

            {phase !== "confirm" && phase !== "reading-photo" && (
                <div className="grid grid-cols-2 gap-2 p-3">
                    <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        aria-label="VIN photo"
                        className="hidden"
                        onChange={(e) => {
                            readPhoto(e.target.files?.[0]);
                            e.target.value = "";
                        }}
                    />
                    <Button type="button" variant="outline" className="h-12 rounded-2xl border-white/15" onClick={() => photoInputRef.current?.click()}>
                        <ImagePlus className="mr-1.5 h-4 w-4" /> Use a Photo
                    </Button>
                    <Button type="button" variant="outline" className="h-12 rounded-2xl border-white/15" onClick={close}>
                        <Keyboard className="mr-1.5 h-4 w-4" /> Enter Manually
                    </Button>
                </div>
            )}
        </div>
    );
}
