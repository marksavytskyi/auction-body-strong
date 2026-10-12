"use client";

import React, { useRef } from "react";
import toast from "react-hot-toast";
import { Loader2, Trash2, Camera, ImagePlus, RefreshCw, X, CheckCircle2 } from "lucide-react";

import { uploadCatalystPhoto, deletePhoto } from "@/lib/catalytic/workerCaptures";
import { CatalyticApiError } from "@/lib/catalytic/api";

// One catalyst's photo strip: server-confirmed photos (from the capture
// response) plus any in-flight local uploads (uploading/failed) that
// haven't landed in that response yet. Each photo goes straight to R2 via
// a presigned PUT the backend hands back — this component never sends
// image bytes through our own Next.js server.
export default function PhotoStrip({ captureId, catalyst, isDraft, pending, onPendingChange, onChanged }) {
    const cameraInputRef = useRef(null);
    const galleryInputRef = useRef(null);

    const startUpload = (files) => {
        Array.from(files || []).forEach((file) => {
            const localId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
            const previewUrl = URL.createObjectURL(file);
            onPendingChange((prev) => [...prev, { localId, file, previewUrl, progress: 0, status: "uploading", error: null }]);

            uploadCatalystPhoto(captureId, catalyst.id, file, {
                onProgress: (pct) => onPendingChange((prev) => prev.map((p) => (p.localId === localId ? { ...p, progress: pct } : p))),
            })
                .then(() => {
                    onPendingChange((prev) => prev.map((p) => (p.localId === localId ? { ...p, status: "done", progress: 100 } : p)));
                    onChanged();
                })
                .catch((err) => {
                    const message = err instanceof CatalyticApiError ? err.message : "Upload failed";
                    onPendingChange((prev) => prev.map((p) => (p.localId === localId ? { ...p, status: "failed", error: message } : p)));
                });
        });
    };

    const retry = (item) => {
        onPendingChange((prev) => prev.map((p) => (p.localId === item.localId ? { ...p, status: "uploading", progress: 0, error: null } : p)));
        uploadCatalystPhoto(captureId, catalyst.id, item.file, {
            onProgress: (pct) => onPendingChange((prev) => prev.map((p) => (p.localId === item.localId ? { ...p, progress: pct } : p))),
        })
            .then(() => {
                onPendingChange((prev) => prev.map((p) => (p.localId === item.localId ? { ...p, status: "done", progress: 100 } : p)));
                onChanged();
            })
            .catch((err) => {
                const message = err instanceof CatalyticApiError ? err.message : "Upload failed";
                onPendingChange((prev) => prev.map((p) => (p.localId === item.localId ? { ...p, status: "failed", error: message } : p)));
            });
    };

    const removePending = (localId) => onPendingChange((prev) => prev.filter((p) => p.localId !== localId));

    const removeServerPhoto = async (photoId) => {
        try {
            await deletePhoto(captureId, catalyst.id, photoId);
            onChanged();
        } catch (e) {
            toast.error(e instanceof CatalyticApiError ? e.message : "Failed to remove photo");
        }
    };

    const activePending = pending.filter((p) => p.status !== "done");
    const serverPhotos = catalyst.photos || [];
    const totalPhotos = serverPhotos.length + activePending.filter((p) => p.status !== "failed").length;

    return (
        <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-white/40 font-bold">
                Catalyst Photos {totalPhotos === 0 && isDraft && <span className="text-amber-400 normal-case">— at least 1 required</span>}
            </div>

            {(serverPhotos.length > 0 || activePending.length > 0) && (
                <div className="grid grid-cols-3 gap-2">
                    {serverPhotos.map((p) => (
                        <div key={p.id} className="relative aspect-square rounded-lg overflow-hidden border border-white/10 bg-black/40">
                            {p.view_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={p.view_url} alt={p.original_filename} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-white/30 text-[10px] px-1 text-center">{p.original_filename}</div>
                            )}
                            <div className="absolute top-1 right-1 bg-emerald-500 rounded-full p-0.5">
                                <CheckCircle2 className="h-3 w-3 text-black" />
                            </div>
                            {isDraft && (
                                <button
                                    type="button"
                                    aria-label="Delete photo"
                                    onClick={() => removeServerPhoto(p.id)}
                                    className="absolute bottom-1 right-1 bg-black/70 rounded-full p-1 text-white/70 hover:text-rose-400"
                                >
                                    <Trash2 className="h-3 w-3" />
                                </button>
                            )}
                        </div>
                    ))}

                    {activePending.map((p) => (
                        <div key={p.localId} className="relative aspect-square rounded-lg overflow-hidden border border-white/10 bg-black/40">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={p.previewUrl} alt="" className="w-full h-full object-cover opacity-60" />
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/50">
                                {p.status === "uploading" ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin text-sky-300" />
                                        <span className="text-[10px] text-sky-200 font-bold">{p.progress}%</span>
                                    </>
                                ) : (
                                    <>
                                        <span className="text-[9px] text-rose-300 text-center px-1 leading-tight">{p.error || "Failed"}</span>
                                        <button
                                            type="button"
                                            onClick={() => retry(p)}
                                            className="inline-flex items-center gap-1 text-[10px] font-bold text-white bg-rose-500/80 rounded px-1.5 py-0.5"
                                        >
                                            <RefreshCw className="h-2.5 w-2.5" /> Retry
                                        </button>
                                    </>
                                )}
                            </div>
                            {p.status === "failed" && (
                                <button type="button" onClick={() => removePending(p.localId)} className="absolute top-1 right-1 bg-black/70 rounded-full p-0.5 text-white/70">
                                    <X className="h-3 w-3" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {isDraft && (
                <div className="flex gap-2">
                    <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { startUpload(e.target.files); e.target.value = ""; }} />
                    <input ref={galleryInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { startUpload(e.target.files); e.target.value = ""; }} />
                    <button type="button" onClick={() => cameraInputRef.current?.click()} className="flex-1 inline-flex items-center justify-center gap-1.5 h-10 rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-300 text-xs font-bold uppercase tracking-wider">
                        <Camera className="h-4 w-4" /> Take Photo
                    </button>
                    <button type="button" onClick={() => galleryInputRef.current?.click()} className="flex-1 inline-flex items-center justify-center gap-1.5 h-10 rounded-xl border border-white/15 bg-white/5 text-white/70 text-xs font-bold uppercase tracking-wider">
                        <ImagePlus className="h-4 w-4" /> Choose Photos
                    </button>
                </div>
            )}
        </div>
    );
}
