"use client";

import React, { useRef, useState } from "react";
import toast from "react-hot-toast";
import { Loader2, ShieldCheck } from "lucide-react";

import RecoveryPreviewDialog from "./RecoveryPreviewDialog";
import { ConfirmDialog } from "@/components/catalytic/CatdbProcessingControls";
import { getRecoveryDryRun, setRecoveryActivation } from "@/lib/operations/api";
import { CatalyticApiError } from "@/lib/catalytic/http";
import { formatDate } from "@/lib/operations/format";

const TURN_OFF_ACTION = {
    title: "Turn off the recovery rules?",
    body: "Every total goes back to the existing valuation. Saved rules and manual prices are kept, and no stored price changes.",
    confirm: "Turn Off",
};

const message = (error, fallback) => (error instanceof CatalyticApiError ? error.message : fallback);

// The one switch between the existing figures and the rules. Either direction shows the
// effect first, and neither changes a stored price.
export default function RecoveryActivationCard({ settings, onChanged }) {
    const [preview, setPreview] = useState(null);
    const [confirmingOff, setConfirmingOff] = useState(false);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const running = useRef(false);
    const active = settings.rules_active;

    const openPreview = async () => {
        setLoading(true);
        setError("");
        try {
            setPreview(await getRecoveryDryRun());
        } catch (e) {
            toast.error(message(e, "Failed to calculate the dry run"));
        } finally {
            setLoading(false);
        }
    };

    const apply = async () => {
        if (running.current) return;
        running.current = true;
        setSaving(true);
        setError("");
        try {
            const updated = await setRecoveryActivation({ active: !active, expectedVersion: settings.version });
            toast.success(active ? "Recovery rules turned off" : "Recovery rules are now active");
            setPreview(null);
            onChanged(updated);
        } catch (e) {
            setError(message(e, "Failed to change activation"));
            if (active) toast.error(message(e, "Failed to change activation"));
        } finally {
            running.current = false;
            setSaving(false);
            setConfirmingOff(false);
        }
    };

    return (
        <section aria-label="Activation" className={`rounded-2xl border p-4 ${active ? "border-emerald-500/30 bg-emerald-500/[0.05]" : "border-amber-500/30 bg-amber-500/[0.05]"}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                    <div className={`inline-flex items-center gap-1.5 text-sm font-black uppercase ${active ? "text-emerald-300" : "text-amber-300"}`}>
                        <ShieldCheck className="h-4 w-4" /> Rules {active ? "active" : "not active"}
                    </div>
                    <p className="mt-1 text-xs text-white/55">
                        {active
                            ? `Every total follows these rules. Active since ${formatDate(settings.activated_at)}.`
                            : "Totals keep the existing valuation. You can save rules now; they change no total until you activate them."}
                    </p>
                </div>
                <button
                    type="button"
                    disabled={loading}
                    onClick={active ? () => setConfirmingOff(true) : openPreview}
                    className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-bold ${active ? "border border-white/15 text-white/85" : "bg-emerald-500 text-black"} disabled:opacity-60`}
                >
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                    {active ? "Turn Off Rules" : "Review and Activate"}
                </button>
            </div>
            {confirmingOff && <ConfirmDialog action={TURN_OFF_ACTION} busy={saving} onConfirm={apply} onClose={() => setConfirmingOff(false)} />}
            {preview && (
                <RecoveryPreviewDialog
                    title="Activate the recovery rules?"
                    preview={preview}
                    note="Every vehicle, batch, dashboard and export total changes to the new figures. No search runs and no stored price changes. You can turn this off again."
                    applyLabel="Activate Rules"
                    busy={saving}
                    error={error}
                    onApply={apply}
                    onCancel={() => setPreview(null)}
                />
            )}
        </section>
    );
}
