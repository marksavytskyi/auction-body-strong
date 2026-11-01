"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";

import RecoveryPreviewDialog from "./RecoveryPreviewDialog";
import RecoveryRulesEditor, { hasEnabledSource, pickRules, rulesEqual } from "./RecoveryRulesEditor";
import { getBatchRecovery, getRecoverySettings, previewBatchRecovery, resetBatchRecovery, saveBatchRecovery } from "@/lib/operations/api";
import { CatalyticApiError } from "@/lib/catalytic/http";

const message = (error, fallback) => (error instanceof CatalyticApiError ? error.message : fallback);

export default function BatchRecoverySettings({ batchId, onChanged }) {
    const [open, setOpen] = useState(false);
    const [rules, setRules] = useState(null);
    const [defaultPriority, setDefaultPriority] = useState(null);
    const [draft, setDraft] = useState(null);
    const [error, setError] = useState("");
    const [pending, setPending] = useState(null);
    const [busy, setBusy] = useState(false);
    const [actionError, setActionError] = useState("");
    const running = useRef(false);

    const load = useCallback(async () => {
        try {
            const [batchRules, settings] = await Promise.all([getBatchRecovery(batchId), getRecoverySettings()]);
            setRules(batchRules);
            setDefaultPriority(settings.default_priority);
            setError("");
        } catch (e) {
            setError(message(e, "Failed to load batch recovery rules"));
        }
    }, [batchId]);

    useEffect(() => {
        if (open && !rules) load();
    }, [open, rules, load]);

    const openPreview = async (kind) => {
        setBusy(true);
        setActionError("");
        try {
            const preview = kind === "reset"
                ? await previewBatchRecovery(batchId, null, { reset: true })
                : await previewBatchRecovery(batchId, draft);
            setPending({ kind, preview });
        } catch (e) {
            toast.error(message(e, "Failed to preview the changes"));
        } finally {
            setBusy(false);
        }
    };

    const apply = async () => {
        if (running.current) return;
        running.current = true;
        setBusy(true);
        setActionError("");
        try {
            const updated = pending.kind === "reset"
                ? await resetBatchRecovery(batchId, { expectedVersion: rules.version })
                : await saveBatchRecovery(batchId, { changes: draft, expectedVersion: rules.version });
            setRules(updated);
            setDraft(null);
            setPending(null);
            toast.success(pending.kind === "reset" ? "Batch now uses the global settings" : "Batch rules saved");
            onChanged?.();
        } catch (e) {
            setActionError(message(e, "Failed to save batch recovery rules"));
            if (e instanceof CatalyticApiError && e.status === 409) load();
        } finally {
            running.current = false;
            setBusy(false);
        }
    };

    const effective = rules && pickRules(rules.effective);
    return (
        <section aria-label="Batch recovery settings" className="rounded-2xl border border-white/10 bg-white/[0.02]">
            <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpen((value) => !value)}
                className="flex min-h-11 w-full items-center gap-2 px-4 text-left text-sm font-bold text-white/80"
            >
                {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                Recovery Settings
                {rules && <span className="text-xs font-normal text-white/45">{rules.customized ? "Customized for this batch" : "Using global settings"}</span>}
            </button>
            {open && (
                <div className="space-y-3 px-4 pb-4">
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
                            {!rules.rules_active && (
                                <p className="text-xs text-amber-200/80">The rules are not active yet, so saving here changes no total until they are activated.</p>
                            )}
                            <div className="flex flex-wrap gap-2">
                                {draft === null && (
                                    <button type="button" onClick={() => setDraft(effective)} className="h-10 rounded-xl border border-white/15 px-4 text-xs font-bold text-white/85">
                                        Customize This Batch
                                    </button>
                                )}
                                {rules.customized && draft === null && (
                                    <button type="button" disabled={busy} onClick={() => openPreview("reset")} className="h-10 rounded-xl border border-white/15 px-4 text-xs font-bold text-white/70 disabled:opacity-40">
                                        Reset Batch to Global Defaults
                                    </button>
                                )}
                            </div>
                            <RecoveryRulesEditor
                                value={draft ?? effective}
                                onChange={setDraft}
                                defaultPriority={defaultPriority}
                                disabled={draft === null}
                                idPrefix={`batch-${batchId}`}
                            />
                            {draft !== null && (
                                <div className="flex justify-end gap-2">
                                    <button type="button" onClick={() => setDraft(null)} className="h-10 rounded-xl border border-white/15 px-4 text-xs font-bold text-white/70">Cancel</button>
                                    <button
                                        type="button"
                                        disabled={busy || !hasEnabledSource(draft) || (rules.customized && rulesEqual(draft, effective))}
                                        onClick={() => openPreview("save")}
                                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-500 px-4 text-xs font-bold text-black disabled:opacity-40"
                                    >
                                        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                                        Preview Changes
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
            {pending && (
                <RecoveryPreviewDialog
                    title={pending.kind === "reset" ? "Return this batch to the global settings?" : "Preview changes to this batch"}
                    preview={pending.preview}
                    note={rules.rules_active ? null : "The rules are not active, so saving changes no total yet. These figures are what activation would show."}
                    busy={busy}
                    error={actionError}
                    onApply={apply}
                    onCancel={() => setPending(null)}
                />
            )}
        </section>
    );
}
