"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";

import { getScrapPrice, setScrapPrice } from "@/lib/operations/api";
import { CatalyticApiError } from "@/lib/catalytic/http";
import { formatDate } from "@/lib/operations/format";
import InfoTip from "@/components/ui/InfoTip";
import { ConfirmDialog } from "@/components/catalytic/CatdbProcessingControls";

const CONFIRM_ACTION = {
    title: "Update the Scrap Price?",
    body: "Updating the Scrap Price will recalculate Scrap values for all vehicles and batches.",
    confirm: "Update price",
};

const UNIT_LABEL = { LB: "lb" };

// The one Scrap price. The backend computes every Scrap value from it, so saving
// here is all it takes; the page only needs to re-read what it shows.
export default function ScrapPriceControl({ onChanged }) {
    const [current, setCurrent] = useState(null);
    const [loadError, setLoadError] = useState("");
    const [draft, setDraft] = useState(null);
    const [confirming, setConfirming] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState("");
    const running = useRef(false);

    const load = useCallback(async () => {
        try {
            setCurrent(await getScrapPrice());
            setLoadError("");
        } catch (e) {
            setLoadError(e instanceof CatalyticApiError ? e.message : "Failed to load the Scrap price");
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const save = async () => {
        if (running.current) return;
        running.current = true;
        setSaving(true);
        setSaveError("");
        try {
            const updated = await setScrapPrice({ price: draft.trim(), weightUnit: current.weight_unit, expectedVersion: current.version });
            setCurrent(updated);
            setDraft(null);
            toast.success("Scrap price updated");
            onChanged?.();
        } catch (e) {
            setSaveError(e instanceof CatalyticApiError ? e.message : "Failed to update the Scrap price");
            if (e instanceof CatalyticApiError && e.status === 409) load();
        } finally {
            running.current = false;
            setSaving(false);
            setConfirming(false);
        }
    };

    if (!current) {
        return (
            <section aria-label="Scrap price" className="rounded-xl border border-white/10 bg-black/25 p-3 text-xs text-white/50">
                {loadError ? (
                    <span className="flex items-center justify-between gap-3 text-rose-300">
                        {loadError}
                        <button type="button" onClick={load} className="underline">Retry</button>
                    </span>
                ) : "Loading Scrap price…"}
            </section>
        );
    }

    const unit = UNIT_LABEL[current.weight_unit] || current.weight_unit;
    const draftValid = draft !== null && /^\d+(\.\d{1,4})?$/.test(draft.trim());

    return (
        <section aria-label="Scrap price" className="rounded-xl border border-white/10 bg-black/25 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                    <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-white/40">
                        Global Scrap Price
                        <InfoTip label="About the Scrap price">
                            One price for every batch, not just this one. Scrap values everywhere, older batches included, use the current price whenever totals are shown. Each batch keeps its own Scrap percentage.
                        </InfoTip>
                    </div>
                    <div className="text-base font-black text-white/90">
                        ${Number(current.price).toFixed(4)} <span className="text-xs font-bold text-white/50">{current.currency} per {unit}</span>
                    </div>
                    <div className="text-[11px] text-white/35">Used by every batch · updated {formatDate(current.updated_at)}</div>
                </div>
                {draft === null && (
                    <button
                        type="button"
                        onClick={() => { setDraft(String(Number(current.price))); setSaveError(""); }}
                        className="h-10 rounded-xl border border-white/15 px-4 text-xs font-bold text-white/85"
                    >
                        Change
                    </button>
                )}
            </div>

            {draft !== null && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    <label htmlFor="scrap-price-input" className="sr-only">New Scrap price in {current.currency} per {unit}</label>
                    <input
                        id="scrap-price-input"
                        inputMode="decimal"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        disabled={saving}
                        className="h-10 w-28 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 text-base text-white sm:flex-none sm:text-sm"
                    />
                    <span className="text-xs text-white/50">{current.currency}/{unit}</span>
                    <button
                        type="button"
                        disabled={!draftValid || saving}
                        onClick={() => setConfirming(true)}
                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-500 px-4 text-xs font-bold text-black disabled:opacity-40"
                    >
                        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                        Save
                    </button>
                    <button type="button" disabled={saving} onClick={() => setDraft(null)} className="h-10 rounded-xl border border-white/15 px-3 text-xs font-bold text-white/70">
                        Cancel
                    </button>
                </div>
            )}
            {saveError && <p role="alert" className="mt-2 text-xs text-rose-300">{saveError}</p>}
            {confirming && <ConfirmDialog action={CONFIRM_ACTION} busy={saving} onConfirm={save} onClose={() => setConfirming(false)} />}
        </section>
    );
}
