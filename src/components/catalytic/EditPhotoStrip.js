"use client";

import React, { useRef } from "react";
import { Camera, CheckCircle2, ImagePlus, Loader2, RefreshCw, Trash2 } from "lucide-react";

import { uploadStagedPhoto } from "@/lib/catalytic/workerCaptures";
import { CatalyticApiError } from "@/lib/catalytic/api";

// Photos while editing a pending submission. New ones upload straight away but stay out of
// the submission until it is saved, and a removed one only leaves when it is saved.
export default function EditPhotoStrip({ captureId, photos, onChange }) {
    const cameraRef = useRef(null);
    const galleryRef = useRef(null);
    const update = (localId, patch) => onChange((all) => all.map((p) => (p.localId === localId ? { ...p, ...patch } : p)));

    const upload = (item) => {
        uploadStagedPhoto(captureId, item.file, { onProgress: (progress) => update(item.localId, { progress }) })
            .then((photoId) => update(item.localId, { status: "done", progress: 100, photoId }))
            .catch((error) => update(item.localId, {
                status: "failed",
                error: error instanceof CatalyticApiError ? error.message : "Upload failed",
            }));
    };

    const addFiles = (files) => {
        const items = Array.from(files || []).map((file) => ({
            localId: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
            file,
            previewUrl: URL.createObjectURL(file),
            status: "uploading",
            progress: 0,
        }));
        onChange((all) => [...all, ...items]);
        items.forEach(upload);
    };

    const remove = (photo) => {
        if (photo.previewUrl) URL.revokeObjectURL(photo.previewUrl);
        onChange((all) => all.filter((p) => p !== photo));
    };

    const retry = (photo) => {
        update(photo.localId, { status: "uploading", progress: 0, error: null });
        upload(photo);
    };

    return (
        <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-white/40 font-bold">
                Catalyst Photos {photos.length === 0 && <span className="text-amber-400 normal-case">— at least 1 required</span>}
            </div>
            {photos.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                    {photos.map((photo) => (
                        <div key={photo.id || photo.localId} className="relative aspect-square rounded-lg overflow-hidden border border-white/10 bg-black/40">
                            {photo.view_url || photo.previewUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={photo.view_url || photo.previewUrl} alt={photo.original_filename || photo.file?.name || ""} className={`w-full h-full object-cover ${photo.status === "uploading" ? "opacity-60" : ""}`} />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-white/30 text-[10px] px-1 text-center">{photo.original_filename}</div>
                            )}
                            {photo.status === "uploading" && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/50">
                                    <Loader2 className="h-4 w-4 animate-spin text-sky-300" />
                                    <span className="text-[10px] text-sky-200 font-bold">{photo.progress}%</span>
                                </div>
                            )}
                            {photo.status === "failed" && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/60">
                                    <span className="text-[9px] text-rose-300 text-center px-1 leading-tight">{photo.error}</span>
                                    <button type="button" onClick={() => retry(photo)} className="inline-flex min-h-8 items-center gap-1 text-[10px] font-bold text-white bg-rose-500/80 rounded px-2">
                                        <RefreshCw className="h-2.5 w-2.5" /> Retry
                                    </button>
                                </div>
                            )}
                            {(photo.id || photo.status === "done") && (
                                <div className="absolute top-1 left-1 bg-emerald-500 rounded-full p-0.5"><CheckCircle2 className="h-3 w-3 text-black" /></div>
                            )}
                            {photo.status !== "uploading" && (
                                <button type="button" aria-label="Remove photo" onClick={() => remove(photo)} className="absolute bottom-1 right-1 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white/80">
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
            <div className="grid grid-cols-2 gap-2">
                <input ref={cameraRef} type="file" accept="image/*" capture="environment" aria-label="Take photo" className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
                <input ref={galleryRef} type="file" accept="image/*" multiple aria-label="Choose photos" className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
                <button type="button" onClick={() => cameraRef.current?.click()} className="inline-flex items-center justify-center gap-1.5 h-11 rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-300 text-xs font-bold">
                    <Camera className="h-4 w-4" /> Take Photo
                </button>
                <button type="button" onClick={() => galleryRef.current?.click()} className="inline-flex items-center justify-center gap-1.5 h-11 rounded-xl border border-white/15 bg-white/5 text-white/70 text-xs font-bold">
                    <ImagePlus className="h-4 w-4" /> Choose Photos
                </button>
            </div>
        </div>
    );
}
