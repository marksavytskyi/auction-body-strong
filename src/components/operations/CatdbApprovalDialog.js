"use client";

import React, { useState } from "react";
import toast from "react-hot-toast";
import { AlertTriangle, ShieldAlert, X } from "lucide-react";

import { approveOperationsCatdbSearches } from "@/lib/operations/api";
import { CatalyticApiError } from "@/lib/catalytic/http";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// The one place this entire phase ever sends a real, paid-search-
// spending request — every field sent is explicit, nothing defaulted
// silently. `preview` must be a just-fetched CatDBPreviewResponse;
// approving always sends preview.fingerprint verbatim as
// preview_fingerprint, never a value the user can edit, so an approval
// can never be submitted against a snapshot the user never actually
// saw. confirm is hardcoded true only at the moment of the explicit
// "Approve" click below — there is no path that reaches
// approveOperationsCatdbSearches without the user clicking this
// specific button in this specific dialog.
export default function CatdbApprovalDialog({ batchId, preview, onClose, onApproved, onStalePreview }) {
    const [maxNewSearches, setMaxNewSearches] = useState(String(preview.max_approvable_new_searches ?? 0));
    const [acknowledged, setAcknowledged] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const ceiling = preview.max_approvable_new_searches ?? 0;
    const parsedMax = Number(maxNewSearches);
    const validMax = maxNewSearches !== "" && Number.isInteger(parsedMax) && parsedMax >= 0 && parsedMax <= ceiling;

    const handleApprove = async () => {
        if (!validMax || !acknowledged || busy) return;
        setBusy(true);
        setError("");
        try {
            const approval = await approveOperationsCatdbSearches(batchId, {
                previewFingerprint: preview.fingerprint,
                maxNewSearches: parsedMax,
                confirm: true,
            });
            toast.success("CatDB approval submitted");
            onApproved?.(approval);
        } catch (e) {
            const message = e instanceof CatalyticApiError ? e.message : "Failed to submit CatDB approval";
            setError(message);
            // A 409 here means either the fingerprint went stale or this
            // fingerprint already has a conflicting decision recorded —
            // in both cases the ONLY safe next step is a brand-new
            // preview, never a silent resubmission with the same or an
            // adjusted number.
            if (e instanceof CatalyticApiError && e.status === 409) {
                onStalePreview?.();
            }
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
            <div
                className="max-w-lg w-full rounded-2xl border border-white/10 bg-[#0b0d12] p-5 sm:p-6 space-y-4"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between">
                    <div className="text-sm font-bold text-white/90 inline-flex items-center gap-2">
                        <ShieldAlert className="h-4 w-4 text-amber-300" /> Confirm CatDB Paid Search Approval
                    </div>
                    <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3 text-xs text-amber-200/90 space-y-1">
                    <div>This will spend real CatDB subscription quota on up to the number of searches you confirm below.</div>
                    <div className="text-white/60">
                        Quota available this period: <span className="font-bold text-white/85">{preview.available_quota}</span> ·
                        {" "}Quota-capped ceiling for this batch: <span className="font-bold text-white/85">{ceiling}</span>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="catdb-max-new-searches">Maximum new searches to approve</Label>
                    <Input
                        id="catdb-max-new-searches"
                        type="number"
                        min={0}
                        max={ceiling}
                        step={1}
                        value={maxNewSearches}
                        onChange={(e) => setMaxNewSearches(e.target.value.replace(/[^0-9]/g, ""))}
                        disabled={busy}
                    />
                    <div className="text-[11px] text-white/35">
                        Must be between 0 and {ceiling} (the quota-capped maximum this preview allows). The actual count spent
                        may be lower if fewer eligible VINs remain.
                    </div>
                    {!validMax && maxNewSearches !== "" && (
                        <div className="text-[11px] text-rose-300">Enter a whole number between 0 and {ceiling}.</div>
                    )}
                </div>

                <label className="flex items-start gap-2.5 text-xs text-white/70 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={acknowledged}
                        onChange={(e) => setAcknowledged(e.target.checked)}
                        disabled={busy}
                        className="mt-0.5"
                    />
                    <span>
                        I understand this will approve up to {maxNewSearches || 0} real, paid CatDB VIN searches for this batch,
                        and this action cannot be undone.
                    </span>
                </label>

                {error && (
                    <div className="rounded-xl border border-rose-500/25 bg-rose-500/[0.06] p-3 text-xs text-rose-300 flex items-start gap-2">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span>
                            {error}
                            {/status 409|fingerprint|conflict/i.test(error) && " Fetch a fresh preview and try again."}
                        </span>
                    </div>
                )}

                <div className="flex items-center justify-end gap-2">
                    <Button type="button" variant="outline" className="rounded-xl" onClick={onClose} disabled={busy}>
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        className="rounded-xl"
                        onClick={handleApprove}
                        disabled={!validMax || !acknowledged || busy}
                        isLoading={busy}
                    >
                        Approve {maxNewSearches || 0} New Search{maxNewSearches === "1" ? "" : "es"}
                    </Button>
                </div>
            </div>
        </div>
    );
}
