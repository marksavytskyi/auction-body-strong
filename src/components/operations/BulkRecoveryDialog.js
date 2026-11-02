"use client";

import React, { useRef, useState } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";

import RecoveryPreviewDialog from "./RecoveryPreviewDialog";
import { applyBulkRecovery, previewBulkRecovery } from "@/lib/operations/api";
import { CatalyticApiError } from "@/lib/catalytic/http";
import { useModalLayer } from "@/hooks/useModalLayer";
import { RECOVERY_COMPONENTS, RECOVERY_MODES, RECOVERY_SOURCE_LABEL } from "@/lib/operations/constants";

const message = (error, fallback) => (error instanceof CatalyticApiError ? error.message : fallback);
const NO_CHANGE = "";
const RESET = "__reset";
const SOURCES = ["OUR_DATABASE", "CATDB_VIN", "CATDB_LOCAL", "ECOTRADE_LOCAL", "NONE"];

function Choice({ id, label, value, onChange, children }) {
    return (
        <div className="flex items-center justify-between gap-2">
            <label htmlFor={id} className="text-xs text-white/75">{label}</label>
            <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-44 rounded-lg border border-white/10 bg-[#0b0d12] px-2 text-xs text-white">
                <option value={NO_CHANGE}>No change</option>
                {children}
            </select>
        </div>
    );
}

// Only what is chosen here changes. Nothing else on those vehicles is touched.
export default function BulkRecoveryDialog({ batchId, vehicleIds, onClose, onApplied }) {
    const [choices, setChoices] = useState({});
    const [restoreDefaults, setRestoreDefaults] = useState(false);
    const [removeManual, setRemoveManual] = useState(false);
    const [preview, setPreview] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const running = useRef(false);
    const zIndex = useModalLayer(true, busy ? undefined : onClose);

    const choice = (key) => choices[key] ?? NO_CHANGE;
    const set = (key) => (value) => setChoices((current) => ({ ...current, [key]: value }));

    const buildBody = () => {
        const changes = {};
        const reset_fields = [];
        for (const { id } of RECOVERY_COMPONENTS) {
            const key = `include_${id}`;
            if (choice(key) === RESET) reset_fields.push(key);
            else if (choice(key) !== NO_CHANGE) changes[key] = choice(key) === "true";
        }
        if (choice("catalytic_source") === RESET) reset_fields.push("catalytic_source");
        else if (choice("catalytic_source") !== NO_CHANGE) changes.catalytic_source = choice("catalytic_source");
        if (choice("allow_approximate") === RESET) reset_fields.push("allow_approximate");
        else if (choice("allow_approximate") !== NO_CHANGE) changes.allow_approximate = choice("allow_approximate") === "true";
        if (choice("valuation_mode") === RESET) reset_fields.push("valuation_mode");
        else if (choice("valuation_mode") !== NO_CHANGE) changes.valuation_mode = choice("valuation_mode");
        if (removeManual) reset_fields.push(...RECOVERY_COMPONENTS.map(({ id }) => `${id}_manual_price`));
        return { vehicle_ids: vehicleIds, changes, reset_fields, restore_batch_defaults: restoreDefaults };
    };

    const body = buildBody();
    const nothingChosen = Object.keys(body.changes).length === 0 && body.reset_fields.length === 0 && !restoreDefaults;

    const openPreview = async () => {
        setBusy(true);
        setError("");
        try {
            setPreview(await previewBulkRecovery(batchId, body));
        } catch (e) {
            setError(message(e, "Failed to preview the bulk edit"));
        } finally {
            setBusy(false);
        }
    };

    const apply = async () => {
        if (running.current) return;
        running.current = true;
        setBusy(true);
        setError("");
        try {
            const result = await applyBulkRecovery(batchId, body);
            toast.success(`${result.vehicles_updated} updated, ${result.vehicles_unchanged} already matched`);
            onApplied?.();
            onClose();
        } catch (e) {
            setError(`Nothing was changed. ${message(e, "Failed to apply the bulk edit")}`);
        } finally {
            running.current = false;
            setBusy(false);
        }
    };

    if (preview) {
        return (
            <RecoveryPreviewDialog
                title={`Apply to ${vehicleIds.length} selected vehicle${vehicleIds.length === 1 ? "" : "s"}?`}
                preview={preview}
                note={preview.rules_active ? null : "This batch's rules are not active, so this changes no total yet. These figures are what activating this batch would show."}
                busy={busy}
                error={error}
                onApply={apply}
                onCancel={() => setPreview(null)}
            />
        );
    }

    return createPortal(
        <div
            role="dialog"
            aria-modal="true"
            aria-label="Bulk Edit Recovery"
            style={{ zIndex }}
            className="fixed inset-0 flex items-center justify-center bg-black/80 p-2 sm:p-3"
            onClick={busy ? undefined : onClose}
        >
            <div className="max-h-[94dvh] w-full max-w-md space-y-2 overflow-auto rounded-2xl border border-white/10 bg-[#0b0d12] p-4 sm:p-5" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-base font-bold text-white">Bulk Edit Recovery</h2>
                <p className="text-xs text-white/50">{vehicleIds.length} selected. Only the settings you choose change.</p>
                {RECOVERY_COMPONENTS.map(({ id, label }) => (
                    <Choice key={id} id={`bulk-${id}`} label={label} value={choice(`include_${id}`)} onChange={set(`include_${id}`)}>
                        <option value="true">Include</option>
                        <option value="false">Exclude</option>
                        <option value={RESET}>Use batch rule</option>
                    </Choice>
                ))}
                <Choice id="bulk-source" label="Catalytic source" value={choice("catalytic_source")} onChange={set("catalytic_source")}>
                    <option value={RESET}>Auto</option>
                    {SOURCES.map((source) => <option key={source} value={source}>{RECOVERY_SOURCE_LABEL[source]}</option>)}
                </Choice>
                <Choice id="bulk-approximate" label="Approximate matches" value={choice("allow_approximate")} onChange={set("allow_approximate")}>
                    <option value="true">Allow</option>
                    <option value="false">Disable</option>
                    <option value={RESET}>Use batch rule</option>
                </Choice>
                <Choice id="bulk-mode" label="Valuation mode" value={choice("valuation_mode")} onChange={set("valuation_mode")}>
                    {RECOVERY_MODES.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
                    <option value={RESET}>Use batch rule</option>
                </Choice>
                <label className="flex items-start gap-2 pt-1 text-xs text-white/75">
                    <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0" checked={restoreDefaults} onChange={(e) => setRestoreDefaults(e.target.checked)} />
                    <span>Restore Batch defaults: remove the vehicles&apos; own rules and source choices, keep manual prices</span>
                </label>
                <label className="flex items-start gap-2 text-xs text-white/75">
                    <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0" checked={removeManual} onChange={(e) => setRemoveManual(e.target.checked)} />
                    <span>Remove manual prices</span>
                </label>
                {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
                <div className="flex justify-end gap-2 pt-2">
                    <button type="button" disabled={busy} onClick={onClose} className="h-10 rounded-xl border border-white/15 px-4 text-sm font-bold text-white/80 disabled:opacity-40">Cancel</button>
                    <button type="button" disabled={busy || nothingChosen} onClick={openPreview} className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-bold text-black disabled:opacity-40">
                        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                        Preview
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
