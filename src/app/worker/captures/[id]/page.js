"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ArrowLeft, Loader2, Trash2, Plus, Send, RotateCcw } from "lucide-react";

import {
    getCapture,
    deleteCapture,
    addCatalyst,
    updateCatalyst,
    deleteCatalyst,
    submitCapture,
    reopenCapture,
    captureIsReadyToSubmit,
    firstIncompleteCatalyst,
    CAPTURE_STATUS,
} from "@/lib/catalytic/workerCaptures";
import { CatalyticApiError } from "@/lib/catalytic/api";
import { Button } from "@/components/ui/button";
import CaptureStatusBadge from "@/components/catalytic/CaptureStatusBadge";
import CatalystCard from "@/components/catalytic/CatalystCard";
import CatalystForm from "@/components/catalytic/CatalystForm";
import ReviewSubmitModal from "@/components/catalytic/ReviewSubmitModal";

function fmtDate(s) {
    if (!s) return "—";
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? s : d.toLocaleString();
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
    const [showReview, setShowReview] = useState(false);

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
    const readyToSubmit = captureIsReadyToSubmit(capture, pendingPhotos);

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

    const handleUpdateCatalyst = async (catalystId, payload) => {
        try {
            await updateCatalyst(id, catalystId, payload);
            toast.success("Saved");
            await load();
            return true;
        } catch (e) {
            // Never silently discard the worker's edit — returning false
            // (never throwing) tells CatalystCard to keep the edit form
            // open with whatever they typed, the same "ok" convention
            // handleAddCatalyst already uses.
            toast.error(e instanceof CatalyticApiError ? e.message : "Failed to save — try again");
            return false;
        }
    };

    const handleDeleteCatalyst = async (catalystId) => {
        if (!confirm("Remove this catalyst? Its photos will be removed too.")) return;
        try {
            await deleteCatalyst(id, catalystId);
            toast.success("Removed");
            load();
        } catch (e) {
            toast.error(e instanceof CatalyticApiError ? e.message : "Failed to remove");
        }
    };

    const handleSubmitTap = () => {
        if (!capture?.catalysts?.length) {
            toast.error("Add at least one catalyst first");
            return;
        }
        if (!readyToSubmit) {
            const incomplete = firstIncompleteCatalyst(capture, pendingPhotos);
            toast.error("Every catalyst needs a code (or marked unreadable) and at least one photo");
            if (incomplete) {
                document.getElementById(`catalyst-${incomplete.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
            }
            return;
        }
        setShowReview(true);
    };

    const handleConfirmSubmit = async () => {
        setIsSubmittingCapture(true);
        try {
            await submitCapture(id);
            toast.success("Submitted for review!");
            setShowReview(false);
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

    if (isLoading) {
        return (
            <div className="flex items-center gap-2 text-white/50 text-sm py-12 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
        );
    }

    if (error || !capture) {
        return (
            <div className="space-y-4">
                <button type="button" onClick={() => router.push("/worker")} className="inline-flex items-center gap-1.5 text-xs text-white/50">
                    <ArrowLeft className="h-3.5 w-3.5" /> Home
                </button>
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium">{error || "Not found"}</div>
            </div>
        );
    }

    return (
        <div className="space-y-5 pb-8">
            <div className="flex items-center justify-between">
                <button type="button" onClick={() => router.push("/worker")} className="inline-flex items-center gap-1.5 text-xs text-white/50">
                    <ArrowLeft className="h-3.5 w-3.5" /> Home
                </button>
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
                    <div className="text-xs font-bold uppercase tracking-wider text-rose-300 mb-1">Rejected — action needed</div>
                    <p className="text-sm text-white/60">{capture.moderator_notes || "No reason given."}</p>
                    <Button size="sm" className="rounded-xl mt-3 w-full h-11" onClick={handleReopen}>
                        <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Fix &amp; Resubmit
                    </Button>
                </div>
            )}

            {capture.status === CAPTURE_STATUS.PENDING_REVIEW && (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.05] p-4 text-sm text-amber-200/80">
                    Submitted for review {fmtDate(capture.submitted_at)} — nothing left to do here. A moderator will confirm or send it back.
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
                        <CatalystCard
                            key={cat.id}
                            index={idx}
                            captureId={id}
                            catalyst={cat}
                            isDraft={isDraft}
                            pendingPhotos={pendingPhotos[cat.id] || []}
                            onPendingChange={(updater) =>
                                setPendingPhotos((prev) => ({ ...prev, [cat.id]: typeof updater === "function" ? updater(prev[cat.id] || []) : updater }))
                            }
                            onChanged={load}
                            onUpdate={handleUpdateCatalyst}
                            onDelete={handleDeleteCatalyst}
                        />
                    ))}
                </div>

                {isDraft && (
                    showAddForm ? (
                        <div className="mt-3">
                            <CatalystForm onSubmit={handleAddCatalyst} isSubmitting={addingCatalyst} />
                            <button type="button" onClick={() => setShowAddForm(false)} className="w-full text-center text-xs text-white/40 mt-2">
                                cancel
                            </button>
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
                    <Button
                        className={`w-full h-14 rounded-2xl text-base ${!readyToSubmit ? "opacity-60" : ""}`}
                        onClick={handleSubmitTap}
                        aria-disabled={!readyToSubmit}
                    >
                        <Send className="h-4 w-4 mr-1.5" /> Submit for Review
                    </Button>
                    {!readyToSubmit && (
                        <p className="text-center text-[11px] text-amber-400">Finish every catalyst (code or unreadable + 1 photo) before submitting.</p>
                    )}
                    <Button variant="outline" className="w-full h-11 rounded-2xl border-white/15" onClick={handleDelete}>
                        <Trash2 className="h-4 w-4 mr-1.5" /> Delete Draft
                    </Button>
                </div>
            )}

            {showReview && (
                <ReviewSubmitModal
                    capture={capture}
                    isSubmitting={isSubmittingCapture}
                    onConfirm={handleConfirmSubmit}
                    onCancel={() => setShowReview(false)}
                />
            )}
        </div>
    );
}
