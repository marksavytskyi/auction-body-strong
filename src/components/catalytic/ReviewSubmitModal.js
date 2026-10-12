"use client";

import React from "react";
import { X, Send } from "lucide-react";

import { Button } from "@/components/ui/button";

function humanizePosition(code) {
    return String(code || "").replace(/_/g, " ");
}

// A deliberate extra step before the real, irreversible action (moving a
// capture out of DRAFT where the worker can no longer edit it) — "avoid
// accidental submission," per the production worker-UI spec. Pure
// presentation: the parent still owns the actual submitCapture() call.
export default function ReviewSubmitModal({ capture, onConfirm, onCancel, isSubmitting }) {
    if (!capture) return null;
    const catalysts = capture.catalysts || [];

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Review before submitting">
            <div className="w-full max-w-md rounded-3xl bg-[#0a0a0a] border border-white/10 p-5 space-y-4 max-h-[85vh] overflow-y-auto">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-black text-white/90">Review &amp; Submit</h2>
                    <button type="button" aria-label="Close" onClick={onCancel} className="text-white/40 hover:text-white p-1">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
                    <div className="text-[10px] uppercase tracking-wider text-white/40 font-bold mb-1">Vehicle</div>
                    <div className="text-base font-bold text-white/90">
                        {[capture.year, capture.make, capture.model].filter(Boolean).join(" ") || "Not identified"}
                    </div>
                    <div className="text-xs text-white/45 mt-0.5 flex items-center gap-3 flex-wrap">
                        {capture.engine && <span>{capture.engine}</span>}
                        {capture.vin && <span className="font-mono">{capture.vin}</span>}
                    </div>
                </div>

                <div className="space-y-2">
                    {catalysts.map((c, idx) => (
                        <div key={c.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3 flex items-center justify-between gap-3">
                            <div>
                                <div className="text-[10px] text-white/30 uppercase tracking-wider">Catalyst #{idx + 1}</div>
                                <div className="text-sm font-bold text-white/85 capitalize">{humanizePosition(c.position_code)}</div>
                                <div className="text-xs font-mono text-white/55">
                                    {c.code_unreadable ? <span className="italic text-white/35">unreadable</span> : c.physical_code_raw || "—"}
                                </div>
                            </div>
                            <div className="text-[11px] text-white/40 whitespace-nowrap">{(c.photos || []).length} photo{(c.photos || []).length === 1 ? "" : "s"}</div>
                        </div>
                    ))}
                </div>

                <div className="space-y-2 pt-1">
                    <Button className="w-full h-14 rounded-2xl text-base" isLoading={isSubmitting} disabled={isSubmitting} onClick={onConfirm}>
                        <Send className="h-4 w-4 mr-1.5" /> Submit for Review
                    </Button>
                    <Button variant="outline" className="w-full h-11 rounded-2xl border-white/15" onClick={onCancel} disabled={isSubmitting}>
                        Back to Edit
                    </Button>
                </div>
            </div>
        </div>
    );
}
