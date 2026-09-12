"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
    ArrowLeft,
    Loader2,
    Trash2,
    Plus,
    Send,
    RotateCcw,
    Camera,
    ImagePlus,
    RefreshCw,
    X,
    CheckCircle2,
} from "lucide-react";

import {
    getCapture,
    deleteCapture,
    addCatalyst,
    deleteCatalyst,
    uploadCatalystPhoto,
    deletePhoto,
    submitCapture,
    reopenCapture,
    CAPTURE_STATUS,
} from "@/lib/catalytic/workerCaptures";
import { CatalyticApiError } from "@/lib/catalytic/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import CaptureStatusBadge from "@/components/catalytic/CaptureStatusBadge";

function fmtDate(s) {
    if (!s) return "—";
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? s : d.toLocaleString();
}

// The backend normalizes position_code (e.g. "front left" -> "front_left")
// — verified live. Display it the way the worker typed it.
function humanizePosition(code) {
    return String(code || "").replace(/_/g, " ");
}

// One catalyst's photo strip: server-confirmed photos (from the capture
// response) plus any in-flight local uploads (uploading/failed) that
// haven't landed in that response yet.
function PhotoStrip({ captureId, catalyst, isDraft, pending, onPendingChange, onChanged }) {
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

    return (
        <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-white/40 font-bold">
                Catalyst Photos {serverPhotos.length + activePending.length === 0 && isDraft && <span className="text-amber-400 normal-case">— required</span>}
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
                                        <button type="button" onClick={() => retry(p)} className="inline-flex items-center gap-1 text-[10px] font-bold text-white bg-rose-500/80 rounded px-1.5 py-0.5">
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

function AddCatalystForm({ onAdd, isSubmitting }) {
    const [positionCode, setPositionCode] = useState("");
    const [code, setCode] = useState("");
    const [unreadable, setUnreadable] = useState(false);
    const [notes, setNotes] = useState("");

    const submit = async (e) => {
        e.preventDefault();
        const ok = await onAdd({
            position_code: positionCode.trim() || "unknown",
            physical_code_raw: unreadable ? "" : code.trim(),
            code_unreadable: unreadable,
            notes: notes.trim(),
        });
        if (ok) {
            setPositionCode(""); setCode(""); setUnreadable(false); setNotes("");
        }
    };

    return (
        <form onSubmit={submit} className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-4 space-y-3">
            <Input value={positionCode} onChange={(e) => setPositionCode(e.target.value)} placeholder="Position (e.g. front left)" className="h-12 rounded-xl bg-white/5 border-white/10" />
            <Input value={code} onChange={(e) => setCode(e.target.value)} disabled={unreadable} placeholder="Stamped code" className="h-12 rounded-xl bg-white/5 border-white/10 font-mono uppercase" />
            <label className="inline-flex items-center gap-2 text-xs text-white/50">
                <input type="checkbox" checked={unreadable} onChange={(e) => setUnreadable(e.target.checked)} className="rounded" />
                Code unreadable / missing
            </label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Note (optional)" className="h-12 rounded-xl bg-white/5 border-white/10" />
            <Button type="submit" className="w-full h-12 rounded-xl" isLoading={isSubmitting}>
                <Plus className="h-4 w-4 mr-1.5" /> Add Catalyst
            </Button>
        </form>
    );
}

export default function WorkerCaptureBuilderPage() {
    const params = useParams();
    const router = useRouter();
    const id = params?.id;

    const [capture, setCapture] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");
    const [addingCatalyst, setAddingCatalyst] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);
    const [pendingPhotos, setPendingPhotos] = useState({}); // catalystId -> [{...}]
    const [isSubmittingCapture, setIsSubmittingCapture] = useState(false);

    const load = useCallback(async () => {
        if (!id) return;
        setIsLoading(true);
        setError("");
        try {
            setCapture(await getCapture(id));
        } catch (e) {
            setError(e instanceof CatalyticApiError ? e.message : "Failed to load capture");
        } finally {
            setIsLoading(false);
        }
    }, [id]);

    useEffect(() => {
        load();
    }, [load]);

    const isDraft = capture?.status === CAPTURE_STATUS.DRAFT;

    const handleAddCatalyst = async (payload) => {
        setAddingCatalyst(true);
        try {
            await addCatalyst(id, payload);
            toast.success("Catalyst added");
            setShowAddForm(false);
            await load();
            return true;
        } catch (e) {
            toast.error(e instanceof CatalyticApiError ? e.message : "Failed to add catalyst");
            return false;
        } finally {
            setAddingCatalyst(false);
        }
    };

    const handleDeleteCatalyst = async (catalystId) => {
        if (!confirm("Remove this catalyst?")) return;
        try {
            await deleteCatalyst(id, catalystId);
            toast.success("Removed");
            load();
        } catch (e) {
            toast.error(e instanceof CatalyticApiError ? e.message : "Failed to remove");
        }
    };

    const hasAnyPhoto = (catalystId) =>
        (capture?.catalysts?.find((c) => c.id === catalystId)?.photos?.length || 0) > 0 ||
        (pendingPhotos[catalystId] || []).some((p) => p.status === "done");

    const allCatalystsHavePhotos = capture?.catalysts?.length > 0 && capture.catalysts.every((c) => hasAnyPhoto(c.id));

    const handleSubmit = async () => {
        if (!capture?.catalysts?.length) {
            toast.error("Add at least one catalyst first");
            return;
        }
        if (!allCatalystsHavePhotos) {
            toast.error("Every catalyst needs at least one photo before submitting");
            return;
        }
        setIsSubmittingCapture(true);
        try {
            await submitCapture(id);
            toast.success("Submitted for review!");
            load();
        } catch (e) {
            toast.error(e instanceof CatalyticApiError ? e.message : "Failed to submit");
        } finally {
            setIsSubmittingCapture(false);
        }
    };

    const handleReopen = async () => {
        try {
            await reopenCapture(id);
            toast.success("Reopened as draft");
            load();
        } catch (e) {
            toast.error(e instanceof CatalyticApiError ? e.message : "Failed to reopen");
        }
    };

    const handleDelete = async () => {
        if (!confirm("Delete this draft?")) return;
        try {
            await deleteCapture(id);
            router.push("/worker");
        } catch (e) {
            toast.error(e instanceof CatalyticApiError ? e.message : "Failed to delete");
        }
    };

    if (isLoading) return <div className="flex items-center gap-2 text-white/50 text-sm py-12 justify-center"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;

    if (error || !capture) {
        return (
            <div className="space-y-4">
                <button type="button" onClick={() => router.push("/worker")} className="inline-flex items-center gap-1.5 text-xs text-white/50"><ArrowLeft className="h-3.5 w-3.5" /> Home</button>
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium">{error || "Not found"}</div>
            </div>
        );
    }

    return (
        <div className="space-y-5 pb-8">
            <div className="flex items-center justify-between">
                <button type="button" onClick={() => router.push("/worker")} className="inline-flex items-center gap-1.5 text-xs text-white/50"><ArrowLeft className="h-3.5 w-3.5" /> Home</button>
                <CaptureStatusBadge status={capture.status} />
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <div className="text-[10px] uppercase tracking-wider text-white/40 font-bold mb-1">Vehicle</div>
                <div className="text-lg font-black text-white/90">
                    {[capture.year, capture.make, capture.model].filter(Boolean).join(" ") || "Not identified"}
                </div>
                <div className="text-xs text-white/45 mt-0.5 flex items-center gap-3 flex-wrap">
                    {capture.engine && <span>{capture.engine}</span>}
                    {capture.vin && <span className="font-mono">{capture.vin}</span>}
                </div>
            </div>

            {capture.status === CAPTURE_STATUS.REJECTED && (
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.05] p-4">
                    <div className="text-xs font-bold uppercase tracking-wider text-rose-300 mb-1">Rejected</div>
                    <p className="text-sm text-white/60">{capture.moderator_notes || "No reason given."}</p>
                    <Button size="sm" className="rounded-xl mt-3 w-full h-11" onClick={handleReopen}>
                        <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Fix and Resubmit
                    </Button>
                </div>
            )}

            {capture.status === CAPTURE_STATUS.PENDING_REVIEW && (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.05] p-4 text-sm text-amber-200/80">
                    Submitted {fmtDate(capture.submitted_at)} — waiting for review.
                </div>
            )}

            {capture.status === CAPTURE_STATUS.APPROVED && (
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.05] p-4 text-sm text-emerald-200/80">
                    Approved {fmtDate(capture.reviewed_at)} — thank you!
                </div>
            )}

            <div>
                <div className="text-[10px] uppercase tracking-wider text-white/40 font-bold mb-2">
                    Catalysts ({capture.catalysts?.length || 0})
                </div>
                <div className="space-y-3">
                    {(capture.catalysts || []).map((cat, idx) => (
                        <div key={cat.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="text-[10px] text-white/30 uppercase tracking-wider">#{idx + 1}</div>
                                    <div className="font-bold text-white/90 capitalize">{humanizePosition(cat.position_code)}</div>
                                    <div className="text-sm text-white/60 font-mono mt-0.5">
                                        {cat.code_unreadable ? <span className="italic text-white/35">code unreadable</span> : cat.physical_code_raw || "—"}
                                    </div>
                                    {cat.notes && <div className="text-[11px] text-white/35 italic mt-1">{cat.notes}</div>}
                                </div>
                                {isDraft && (
                                    <button type="button" onClick={() => handleDeleteCatalyst(cat.id)} className="text-white/30 hover:text-rose-400 p-1">
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                )}
                            </div>

                            <PhotoStrip
                                captureId={id}
                                catalyst={cat}
                                isDraft={isDraft}
                                pending={pendingPhotos[cat.id] || []}
                                onPendingChange={(updater) =>
                                    setPendingPhotos((prev) => ({ ...prev, [cat.id]: typeof updater === "function" ? updater(prev[cat.id] || []) : updater }))
                                }
                                onChanged={load}
                            />
                        </div>
                    ))}
                </div>

                {isDraft && (
                    showAddForm ? (
                        <div className="mt-3">
                            <AddCatalystForm onAdd={handleAddCatalyst} isSubmitting={addingCatalyst} />
                            <button type="button" onClick={() => setShowAddForm(false)} className="w-full text-center text-xs text-white/40 mt-2">cancel</button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setShowAddForm(true)}
                            className="w-full mt-3 h-12 rounded-2xl border border-dashed border-white/20 text-white/60 text-sm font-bold uppercase tracking-wider inline-flex items-center justify-center gap-1.5"
                        >
                            <Plus className="h-4 w-4" /> Add Another Catalyst
                        </button>
                    )
                )}
            </div>

            {isDraft && (
                <div className="space-y-2 sticky bottom-3">
                    <Button className="w-full h-14 rounded-2xl text-base" isLoading={isSubmittingCapture} onClick={handleSubmit}>
                        <Send className="h-4 w-4 mr-1.5" /> Submit for Review
                    </Button>
                    <Button variant="outline" className="w-full h-11 rounded-2xl border-white/15" onClick={handleDelete}>
                        <Trash2 className="h-4 w-4 mr-1.5" /> Delete Draft
                    </Button>
                </div>
            )}
        </div>
    );
}
