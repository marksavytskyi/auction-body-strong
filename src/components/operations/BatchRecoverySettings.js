"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";

import RecoveryPreviewDialog from "./RecoveryPreviewDialog";
import RecoveryRulesEditor, { hasEnabledSource, pickRules, rulesEqual } from "./RecoveryRulesEditor";
import { getBatchRecovery, listRecoveryEvents, previewBatchRecovery, saveBatchRecovery } from "@/lib/operations/api";
import { CatalyticApiError } from "@/lib/catalytic/http";
import { formatDate } from "@/lib/operations/format";

const message = (error, fallback) => (error instanceof CatalyticApiError ? error.message : fallback);

const EVENT_LABEL = {
    ACTIVATE: "Rules activated",
    DEACTIVATE: "Rules turned off",
    UPDATE_BATCH: "Rules changed",
    RESET_BATCH: "Reset to global settings",
    UPDATE_VEHICLE: "Vehicle rules changed",
    RESET_VEHICLE: "Vehicle reset to batch rules",
    BULK_EDIT: "Bulk edit",
};

function History({ batchId, refreshKey }) {
    const [items, setItems] = useState(null);
    useEffect(() => {
        listRecoveryEvents({ batchId }).then((data) => setItems(data.items)).catch(() => setItems([]));
    }, [batchId, refreshKey]);
    if (!items || items.length === 0) return null;
    return (
        <div>
            <h3 className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-white/40">Recent changes</h3>
            <ul className="space-y-1 text-xs text-white/70">
                {items.map((event) => (
                    <li key={event.id} className="flex flex-wrap justify-between gap-x-3">
                        <span>
                            {EVENT_LABEL[event.action] || event.action}
                            {event.operations_batch_vehicle_id && ` · Vehicle ${event.operations_batch_vehicle_id}`}
                            {event.reason && ` · ${event.reason}`}
                        </span>
                        <span className="text-white/40">{formatDate(event.created_at)}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default function BatchRecoverySettings({ batchId, onChanged }) {
    const [open, setOpen] = useState(false);
    const [rules, setRules] = useState(null);
    const [draft, setDraft] = useState(null);
    const [error, setError] = useState("");
    const [preview, setPreview] = useState(null);
    const [previewing, setPreviewing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState("");
    const [historyKey, setHistoryKey] = useState(0);
    const running = useRef(false);

    const applyLoaded = useCallback((data) => {
        setRules(data);
        setDraft(pickRules(data));
    }, []);

    const load = useCallback(async () => {
        try {
            applyLoaded(await getBatchRecovery(batchId));
            setError("");
        } catch (e) {
            setError(message(e, "Failed to load this batch's Recovery Settings"));
        }
    }, [batchId, applyLoaded]);

    useEffect(() => { load(); }, [load]);

    const changed = rules && draft && !rulesEqual(draft, rules);

    const openPreview = async () => {
        setPreviewing(true);
        setSaveError("");
        try {
            setPreview(await previewBatchRecovery(batchId, draft));
        } catch (e) {
            toast.error(message(e, "Failed to preview the changes"));
        } finally {
            setPreviewing(false);
        }
    };

    const save = async () => {
        if (running.current) return;
        running.current = true;
        setSaving(true);
        setSaveError("");
        try {
            applyLoaded(await saveBatchRecovery(batchId, { changes: draft, expectedVersion: rules.version }));
            setPreview(null);
            setHistoryKey((key) => key + 1);
            toast.success("Estimate settings saved");
            onChanged?.();
        } catch (e) {
            setSaveError(message(e, "Failed to save Recovery Settings"));
            if (e instanceof CatalyticApiError && e.status === 409) load();
        } finally {
            running.current = false;
            setSaving(false);
        }
    };

    return (
        <section aria-label="Vehicle estimate settings" className="rounded-2xl border border-white/10 bg-white/[0.02]">
            <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpen((value) => !value)}
                className="flex min-h-11 w-full items-center gap-2 px-4 text-left text-sm font-bold text-white/80"
            >
                {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                Vehicle Estimate Settings
            </button>
            {open && (
                <div className="space-y-4 px-4 pb-4">
                    {!rules ? (
                        <div className="text-sm text-white/50">
                            {error ? (
                                <span className="flex items-center justify-between gap-3 text-rose-300">
                                    {error}
                                    <button type="button" onClick={load} className="underline">Retry</button>
                                </span>
                            ) : "Loading…"}
                        </div>
                    ) : (
                        <>
                            <p className="text-[11px] text-white/40">
                                How each vehicle&apos;s estimate is built in this batch: Scrap + Engine + Transmission + one catalytic price. These settings choose among prices already stored; searching happens in Catalytic Processing.
                            </p>
                            <RecoveryRulesEditor
                                value={draft}
                                onChange={setDraft}
                                defaultPriority={rules.default_priority}
                                idPrefix={`batch-${batchId}`}
                            />
                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    disabled={!changed}
                                    onClick={() => setDraft(pickRules(rules))}
                                    className="h-10 rounded-xl border border-white/15 px-4 text-xs font-bold text-white/70 disabled:opacity-40"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    disabled={!changed || !hasEnabledSource(draft) || previewing}
                                    onClick={openPreview}
                                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-500 px-4 text-xs font-bold text-black disabled:opacity-40"
                                >
                                    {previewing && <Loader2 className="h-4 w-4 animate-spin" />}
                                    Preview Changes
                                </button>
                            </div>
                            <History batchId={batchId} refreshKey={historyKey} />
                        </>
                    )}
                </div>
            )}
            {preview && (
                <RecoveryPreviewDialog
                    title={`Preview changes to Batch #${batchId}`}
                    preview={preview}
                    applyLabel="Save Rules"
                    busy={saving}
                    error={saveError}
                    onApply={save}
                    onCancel={() => setPreview(null)}
                />
            )}
        </section>
    );
}
