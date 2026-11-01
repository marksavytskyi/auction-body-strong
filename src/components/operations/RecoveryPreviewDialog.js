"use client";

import React from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";

import { useModalLayer } from "@/hooks/useModalLayer";
import { RECOVERY_SOURCE_LABEL } from "@/lib/operations/constants";
import { completenessMeta, formatMoney } from "@/lib/operations/format";

function Figure({ label, value, tone }) {
    return (
        <div className="min-w-0 rounded-lg border border-white/10 p-2">
            <dt className="text-[10px] font-bold uppercase tracking-wider text-white/40">{label}</dt>
            <dd className={`truncate text-sm font-black ${tone || "text-white/90"}`}>{value}</dd>
        </div>
    );
}

function signedMoney(value) {
    const number = Number(value);
    return `${number > 0 ? "+" : ""}${formatMoney(value)}`;
}

// Every number here is the backend's, from the same calculation saving uses.
export default function RecoveryPreviewDialog({ title, preview, note, applyLabel = "Apply Changes", busy, error, onApply, onCancel }) {
    const zIndex = useModalLayer(true, busy ? undefined : onCancel);
    const sources = Object.entries(preview.catalytic_sources || {}).sort((a, b) => b[1] - a[1]);
    const difference = Number(preview.difference);
    return createPortal(
        <div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            style={{ zIndex }}
            className="fixed inset-0 flex items-center justify-center bg-black/80 p-2 sm:p-3"
            onClick={busy ? undefined : onCancel}
        >
            <div className="max-h-[94dvh] w-full max-w-lg space-y-3 overflow-auto rounded-2xl border border-white/10 bg-[#0b0d12] p-4 sm:p-5" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-base font-bold text-white">{title}</h2>
                <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <Figure label="Current total" value={formatMoney(preview.current_total)} />
                    <Figure label="New total" value={formatMoney(preview.new_total)} tone="text-emerald-300" />
                    <Figure
                        label="Difference"
                        value={signedMoney(preview.difference)}
                        tone={difference < 0 ? "text-rose-300" : difference > 0 ? "text-emerald-300" : undefined}
                    />
                    <Figure label="Vehicles affected" value={`${preview.vehicles_affected} of ${preview.vehicles_evaluated}`} />
                    <Figure label="Batches affected" value={preview.batches_affected} />
                    <Figure label="Missing values" value={preview.missing_values} tone={preview.missing_values ? "text-amber-300" : undefined} />
                    <Figure label="Approximate included" value={preview.approximate_included} />
                    <Figure label="Flagged, excluded" value={preview.uncertain_excluded} />
                </dl>
                <div className="text-xs">
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-white/40">Catalytic value by source</div>
                    <ul className="space-y-0.5 text-white/70">
                        {sources.map(([source, count]) => (
                            <li key={source} className="flex justify-between gap-3">
                                <span>{RECOVERY_SOURCE_LABEL[source] || source}</span>
                                <span className="font-bold text-white/90">{count} vehicle{count === 1 ? "" : "s"}</span>
                            </li>
                        ))}
                    </ul>
                </div>
                {preview.completeness && Object.keys(preview.completeness).length > 0 && (
                    <p className="text-[11px] text-white/45">
                        {Object.entries(preview.completeness).map(([status, count]) => `${completenessMeta(status).label}: ${count}`).join(" · ")}
                    </p>
                )}
                {note && <p className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] p-2 text-xs text-amber-200/90">{note}</p>}
                {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
                <div className="flex justify-end gap-2 pt-1">
                    <button type="button" disabled={busy} onClick={onCancel} className="h-10 rounded-xl border border-white/15 px-4 text-sm font-bold text-white/80 disabled:opacity-40">
                        Cancel
                    </button>
                    {onApply && (
                        <button type="button" disabled={busy} onClick={onApply} className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-bold text-black disabled:opacity-60">
                            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                            {applyLabel}
                        </button>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}
