"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { ShieldAlert, X } from "lucide-react";

import { useModalLayer } from "@/hooks/useModalLayer";

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : /(s|ch|sh|x)$/.test(word) ? "es" : "s"}`;

// Phase K.52 — the one confirmation for a Run that includes CatDB VIN. Every number comes
// from the read-only preview just fetched; approving sends that preview's fingerprint and
// exactly the number shown, so nothing else can be searched with this approval.
export function paidExclusions(preview) {
    const eligible = preview.max_approvable_new_searches;
    return [
        ["already searched: their stored result is reused free, as CatDB VIN", preview.reusable_count],
        ["answered free by CatDB Local: same configuration as an earlier paid search", preview.local_cache_hit_count || 0],
        ["already queued or running", preview.active_existing_job_count],
        ["searched before with an unknown outcome: never searched again automatically", preview.uncertain_count],
        ["CatDB already answered with no result", preview.conclusive_no_data_count],
        ["not searchable (masked or invalid VIN)", preview.ineligible_count],
        ["over this period's remaining quota", Math.max(0, preview.never_searched_count - eligible)],
    ].filter(([, n]) => n > 0);
}

// K.58 — the VINs CatDB Local answers from another vehicle's paid result.
export const cacheHitVins = (preview) => (preview.entries || []).filter((e) => e.category === "LOCAL_CACHE_HIT" && e.vin).map((e) => e.vin);

export default function PaidRunDialog({ preview, freeSummary, paused, busy, onApprove, onFreeOnly, onForceExact, onClose }) {
    const [ticked, setTicked] = useState(false);
    const [forceTicked, setForceTicked] = useState(false);
    const forced = preview.forced_exact_vins || [];
    const hits = cacheHitVins(preview);
    const zIndex = useModalLayer(true, busy ? undefined : onClose);
    const eligible = preview.max_approvable_new_searches;
    const excluded = paidExclusions(preview);
    const excludedTotal = excluded.reduce((n, [, count]) => n + count, 0);

    return createPortal(
        <div role="dialog" aria-modal="true" aria-label="Approve paid CatDB VIN searches?" style={{ zIndex }}
            className="fixed inset-0 flex items-end justify-center bg-black/80 sm:items-center sm:p-4" onClick={busy ? undefined : onClose}>
            <div className="max-h-[92vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-t-2xl border border-white/10 bg-[#0b0d12] p-4 sm:rounded-2xl sm:p-5" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start justify-between gap-3">
                    <h2 className="inline-flex items-center gap-2 text-sm font-bold text-white/90">
                        <ShieldAlert className="h-4 w-4 text-amber-300" /> Approve paid CatDB VIN searches?
                    </h2>
                    <button type="button" aria-label="Close" disabled={busy} onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/50 hover:bg-white/10">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <dl className="grid grid-cols-2 gap-2 text-center">
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-2.5">
                        <dt className="text-[10px] font-bold uppercase tracking-wider text-amber-200/80">Paid searches, at most</dt>
                        <dd className="text-xl font-black text-amber-100">{eligible}</dd>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/25 p-2.5">
                        <dt className="text-[10px] font-bold uppercase tracking-wider text-white/45">Quota left this period</dt>
                        <dd className="text-xl font-black text-white/85">{preview.available_quota}</dd>
                    </div>
                </dl>

                <div className="space-y-1 text-xs text-white/70">
                    <p>{plural(eligible, "VIN")} in this scope {eligible === 1 ? "has" : "have"} never been searched and can be searched now. Each search uses one unit of quota.</p>
                    {excludedTotal > 0 && (
                        <div>
                            <p>{plural(excludedTotal, "VIN")} won&apos;t be searched:</p>
                            <ul className="ml-4 list-disc text-white/55">
                                {excluded.map(([reason, count]) => <li key={reason}>{count} {reason}</li>)}
                            </ul>
                        </div>
                    )}
                    <p className={paused ? "text-amber-200" : "text-white/70"}>
                        {paused
                            ? "CatDB is paused, so approved searches wait until it is resumed in CATS → CatDB Automation."
                            : "CatDB is running, so a device may start these searches right away."}
                    </p>
                    {freeSummary && <p className="text-white/55">{freeSummary}</p>}
                </div>

                {hits.length > 0 && onForceExact && (
                    <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.05] p-2.5 text-xs text-white/70">
                        <p>{plural(hits.length, "VIN")} {hits.length === 1 ? "is" : "are"} answered free by CatDB Local, from an earlier paid search of the same configuration. That value is inferred, not this VIN&apos;s own result.</p>
                        <button type="button" disabled={busy} onClick={() => onForceExact(hits)}
                            className="mt-2 h-8 rounded-lg border border-sky-400/30 px-3 text-[11px] font-bold text-sky-200">
                            Force exact VIN search for {plural(hits.length, "VIN")}…
                        </button>
                    </div>
                )}

                {forced.length > 0 && (
                    <label className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/[0.06] p-2.5 text-xs text-red-100">
                        <input type="checkbox" checked={forceTicked} disabled={busy} onChange={(e) => setForceTicked(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>
                            I also confirm paying for exact searches of {plural(forced.length, "VIN")} that CatDB Local already answers
                            ({forced.join(", ")}). They are included in the {plural(eligible, "search")} above.
                        </span>
                    </label>
                )}

                <label className="flex items-start gap-2 rounded-xl border border-white/10 bg-black/25 p-2.5 text-xs text-white/80">
                    <input type="checkbox" checked={ticked} disabled={busy || eligible === 0} onChange={(e) => setTicked(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" />
                    I approve up to {plural(eligible, "paid CatDB VIN search")} for this batch.
                </label>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button type="button" disabled={busy} onClick={onClose} className="h-10 rounded-xl border border-white/15 px-4 text-xs font-bold text-white/70">Cancel</button>
                    {onFreeOnly && (
                        <button type="button" disabled={busy} onClick={onFreeOnly} className="h-10 rounded-xl border border-white/15 px-4 text-xs font-bold text-white/85">
                            Run free sources only
                        </button>
                    )}
                    <button type="button" disabled={busy || !ticked || eligible === 0 || (forced.length > 0 && !forceTicked)} onClick={onApprove}
                        className="h-10 rounded-xl bg-amber-400 px-4 text-xs font-bold text-black disabled:opacity-40">
                        {busy ? "Starting…" : `Approve ${plural(eligible, "search")} & run`}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
