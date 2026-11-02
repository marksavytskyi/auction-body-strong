"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ArrowLeft, Loader2, Pencil, Plus, Send, Trash2 } from "lucide-react";

import { CAPTURE_STATUS, deleteStagedPhoto, getCapture, resubmitCapture } from "@/lib/catalytic/workerCaptures";
import { CatalyticApiError } from "@/lib/catalytic/api";
import { Button } from "@/components/ui/button";
import CatalystForm from "@/components/catalytic/CatalystForm";
import EditPhotoStrip from "@/components/catalytic/EditPhotoStrip";
import VehicleDetailsFields, { vehicleCanContinue } from "@/components/catalytic/VehicleDetailsFields";

const humanizePosition = (code) => String(code || "").replace(/_/g, " ");

const fromCapture = (capture) => ({
    vehicle: {
        vin: capture.vin || "", year: capture.year ? String(capture.year) : "", make: capture.make || "",
        model: capture.model || "", engine: capture.engine || "",
    },
    notes: capture.notes || "",
    catalysts: (capture.catalysts || []).map((c) => ({
        key: `saved-${c.id}`, id: c.id, position_code: c.position_code, physical_code_raw: c.physical_code_raw,
        code_unreadable: c.code_unreadable, notes: c.notes, photos: c.photos || [],
    })),
});

const stagedIds = (catalysts) => catalysts.flatMap((c) => c.photos).filter((p) => p.photoId).map((p) => p.photoId);

function CatalystEditor({ index, captureId, catalyst, onChange, onRemove }) {
    const [editing, setEditing] = useState(false);
    const setPhotos = (updater) => onChange((current) => ({ ...current, photos: typeof updater === "function" ? updater(current.photos) : updater }));
    return (
        <div id={`catalyst-${catalyst.key}`} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
            {editing ? (
                <CatalystForm
                    initial={catalyst}
                    submitLabel="Done"
                    onCancel={() => setEditing(false)}
                    onSubmit={async (values) => {
                        onChange((current) => ({ ...current, ...values }));
                        setEditing(false);
                        return true;
                    }}
                />
            ) : (
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="text-[10px] text-white/30 uppercase tracking-wider">Catalyst #{index + 1}</div>
                        <div className="font-bold text-white/90 capitalize">{humanizePosition(catalyst.position_code)}</div>
                        <div className="text-sm text-white/60 font-mono mt-0.5 break-all">
                            {catalyst.code_unreadable ? <span className="italic text-white/35">code unreadable</span> : catalyst.physical_code_raw || "—"}
                        </div>
                        {catalyst.notes && <div className="text-[11px] text-white/35 italic mt-1">{catalyst.notes}</div>}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                        <button type="button" aria-label="Edit catalyst" onClick={() => setEditing(true)} className="flex h-11 w-11 items-center justify-center rounded-xl text-white/50">
                            <Pencil className="h-4 w-4" />
                        </button>
                        <button type="button" aria-label="Remove catalyst" onClick={onRemove} className="flex h-11 w-11 items-center justify-center rounded-xl text-white/50">
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}
            <EditPhotoStrip captureId={captureId} photos={catalyst.photos} onChange={setPhotos} />
        </div>
    );
}

export default function EditSubmissionPage() {
    const params = useParams();
    const router = useRouter();
    const id = params?.id;

    const [capture, setCapture] = useState(null);
    const [form, setForm] = useState(null);
    const [error, setError] = useState("");
    const [saveError, setSaveError] = useState("");
    const [conflict, setConflict] = useState(false);
    const [saving, setSaving] = useState(false);
    const [adding, setAdding] = useState(false);
    const nextKey = useRef(0);
    const running = useRef(false);

    const load = useCallback(async () => {
        setError("");
        setConflict(false);
        setSaveError("");
        try {
            const data = await getCapture(id);
            setCapture(data);
            setForm(fromCapture(data));
        } catch (e) {
            setError(e instanceof CatalyticApiError ? e.message : "Failed to load the submission");
        }
    }, [id]);

    useEffect(() => { if (id) load(); }, [id, load]);

    const backToDetail = () => router.push(`/worker/captures/${id}`);

    const discardUploads = useCallback(() => {
        if (form) stagedIds(form.catalysts).forEach((photoId) => deleteStagedPhoto(id, photoId).catch(() => {}));
    }, [form, id]);

    if (error) {
        return (
            <div className="space-y-4">
                <button type="button" onClick={backToDetail} className="inline-flex min-h-11 items-center gap-1.5 text-xs text-white/50"><ArrowLeft className="h-3.5 w-3.5" /> Back</button>
                <div role="alert" className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium">{error}</div>
            </div>
        );
    }
    if (!capture || !form) {
        return <div className="flex items-center gap-2 text-white/50 text-sm py-12 justify-center"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
    }
    if (capture.status !== CAPTURE_STATUS.PENDING_REVIEW) {
        return (
            <div className="space-y-4">
                <button type="button" onClick={backToDetail} className="inline-flex min-h-11 items-center gap-1.5 text-xs text-white/50"><ArrowLeft className="h-3.5 w-3.5" /> Back</button>
                <div role="alert" className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-sm">
                    This submission is no longer pending review, so it can&apos;t be edited here.
                </div>
            </div>
        );
    }

    const allPhotos = form.catalysts.flatMap((c) => c.photos);
    const uploading = allPhotos.some((p) => p.status === "uploading");
    const failed = allPhotos.some((p) => p.status === "failed");
    const missingPhoto = form.catalysts.some((c) => c.photos.length === 0);
    const vehicleOk = vehicleCanContinue(form.vehicle) && form.vehicle.year && form.vehicle.make.trim() && form.vehicle.model.trim();
    const blocker = !vehicleOk ? "Enter a valid VIN or leave it blank, plus year, make and model."
        : form.catalysts.length === 0 ? "Add at least one catalyst."
            : missingPhoto ? "Every catalyst needs at least one photo."
                : uploading ? "Waiting for photos to finish uploading."
                    : failed ? "Retry or remove the photos that failed to upload."
                        : "";

    const updateCatalyst = (key, updater) => setForm((f) => ({ ...f, catalysts: f.catalysts.map((c) => (c.key === key ? updater(c) : c)) }));

    const removeCatalyst = (catalyst) => {
        if (!window.confirm("Remove this catalyst from the submission?")) return;
        stagedIds([catalyst]).forEach((photoId) => deleteStagedPhoto(id, photoId).catch(() => {}));
        setForm((f) => ({ ...f, catalysts: f.catalysts.filter((c) => c.key !== catalyst.key) }));
    };

    const save = async () => {
        if (running.current || blocker) return;
        running.current = true;
        setSaving(true);
        setSaveError("");
        try {
            await resubmitCapture(id, {
                expected_revision: capture.revision,
                vin: form.vehicle.vin.trim(),
                year: Number(form.vehicle.year),
                make: form.vehicle.make.trim(),
                model: form.vehicle.model.trim(),
                engine: form.vehicle.engine.trim(),
                notes: form.notes,
                catalysts: form.catalysts.map((c) => ({
                    id: c.id ?? null,
                    position_code: c.position_code,
                    physical_code_raw: c.physical_code_raw,
                    code_unreadable: c.code_unreadable,
                    notes: c.notes,
                    photo_ids: c.photos.map((p) => p.id ?? p.photoId),
                })),
            });
            toast.success("Saved and resubmitted for review");
            backToDetail();
        } catch (e) {
            if (e instanceof CatalyticApiError && e.status === 409) setConflict(true);
            setSaveError(e instanceof CatalyticApiError ? e.message : "Failed to save your changes. Nothing was changed; try again.");
        } finally {
            running.current = false;
            setSaving(false);
        }
    };

    return (
        <div className="space-y-5 pb-8">
            <button type="button" onClick={() => { discardUploads(); backToDetail(); }} className="inline-flex min-h-11 items-center gap-1.5 text-xs text-white/50">
                <ArrowLeft className="h-3.5 w-3.5" /> Discard changes
            </button>
            <div>
                <div className="text-[11px] uppercase tracking-wider text-white/40 font-bold">Revision {capture.revision}</div>
                <h1 className="text-xl font-black text-white/90 mt-1">Edit Submission</h1>
                <p className="mt-1 text-xs text-white/50">Moderators keep seeing the current version until you save.</p>
            </div>

            <VehicleDetailsFields value={form.vehicle} onChange={(vehicle) => setForm((f) => ({ ...f, vehicle }))} captureId={capture.id} />

            <div>
                <div className="text-[10px] uppercase tracking-wider text-white/40 font-bold mb-2">Catalysts ({form.catalysts.length})</div>
                <div className="space-y-3">
                    {form.catalysts.map((catalyst, index) => (
                        <CatalystEditor
                            key={catalyst.key}
                            index={index}
                            captureId={capture.id}
                            catalyst={catalyst}
                            onChange={(updater) => updateCatalyst(catalyst.key, updater)}
                            onRemove={() => removeCatalyst(catalyst)}
                        />
                    ))}
                </div>
                {adding ? (
                    <div className="mt-3">
                        <CatalystForm
                            onCancel={() => setAdding(false)}
                            onSubmit={async (values) => {
                                nextKey.current += 1;
                                setForm((f) => ({ ...f, catalysts: [...f.catalysts, { key: `new-${nextKey.current}`, ...values, photos: [] }] }));
                                setAdding(false);
                                return true;
                            }}
                        />
                    </div>
                ) : (
                    <button type="button" onClick={() => setAdding(true)} className="w-full mt-3 h-12 rounded-2xl border border-dashed border-white/20 text-white/60 text-sm font-bold uppercase tracking-wider inline-flex items-center justify-center gap-2">
                        <Plus className="h-4 w-4" /> Add Another Catalyst
                    </button>
                )}
            </div>

            {saveError && <div role="alert" className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">{saveError}</div>}

            {conflict ? (
                <Button type="button" className="w-full h-14 rounded-2xl text-base" onClick={() => { discardUploads(); load(); }}>
                    Reload the Latest Version
                </Button>
            ) : (
                <div className="space-y-2 sticky bottom-[max(0.75rem,env(safe-area-inset-bottom))]">
                    <Button type="button" className="w-full h-14 rounded-2xl text-base" isLoading={saving} disabled={saving || Boolean(blocker)} onClick={save}>
                        <Send className="h-4 w-4 mr-1.5" /> Save &amp; Resubmit for Review
                    </Button>
                    {blocker && <p className="text-center text-[11px] text-amber-400">{blocker}</p>}
                </div>
            )}
        </div>
    );
}
