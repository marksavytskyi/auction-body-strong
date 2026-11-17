"use client";

import React, { useRef, useState } from "react";
import toast from "react-hot-toast";

import { clearErrorHistory } from "@/lib/catalytic/catdbAdmin";
import { CatalyticApiError } from "@/lib/catalytic/api";
import { ConfirmDialog } from "@/components/catalytic/CatdbProcessingControls";

// K.62 — the Recent Errors panel. Clear History only hides the errors listed now: the jobs
// keep their errors (and stay in the jobs list), and no result, quota or device changes.
const CLEAR_ACTION = {
    title: "Clear CatDB Error History?",
    body: "This will clear the displayed error history. CatDB jobs, search results, and processing data will remain unchanged.",
    confirm: "Clear History",
};

export default function CatdbRecentErrors({ errors, onCleared }) {
    const [confirming, setConfirming] = useState(false);
    const [busy, setBusy] = useState(false);
    const running = useRef(false);
    const list = errors || [];

    const clear = async () => {
        if (running.current) return;
        running.current = true;
        setBusy(true);
        try {
            const res = await clearErrorHistory();
            toast.success(`Cleared ${res.cleared_count} error${res.cleared_count === 1 ? "" : "s"}`);
            setConfirming(false);
            await onCleared?.();
        } catch (e) {
            toast.error(e instanceof CatalyticApiError ? e.message : "Failed to clear CatDB error history");
        } finally {
            running.current = false;
            setBusy(false);
        }
    };

    return (
        <div className={`rounded-2xl border p-4 ${list.length ? "border-rose-500/20 bg-rose-500/[0.04]" : "border-white/10 bg-black/20"}`}>
            <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-rose-300">Recent Errors</h3>
                {list.length > 0 && (
                    <button
                        type="button"
                        onClick={() => setConfirming(true)}
                        className="h-8 rounded-lg border border-white/15 px-3 text-[11px] font-bold text-white/70 hover:bg-white/10"
                    >
                        Clear History
                    </button>
                )}
            </div>
            {list.length === 0 ? (
                <p className="text-xs text-white/40">No recent errors</p>
            ) : (
                <div className="space-y-1.5">
                    {list.map((e) => (
                        <div key={`${e.job_id}-${e.error_code}`} className="text-xs text-white/60 flex items-center justify-between gap-2">
                            <span className="font-mono">{e.vin}</span>
                            <span className="text-white/40">{e.error_code}</span>
                            <span className="text-rose-300/80 truncate max-w-[40%]">{e.error_message}</span>
                        </div>
                    ))}
                </div>
            )}
            {confirming && (
                <ConfirmDialog action={CLEAR_ACTION} busy={busy} onConfirm={clear} onClose={() => setConfirming(false)} cancelLabel="Cancel" />
            )}
        </div>
    );
}
