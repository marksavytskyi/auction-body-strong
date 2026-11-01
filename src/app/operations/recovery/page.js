"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { ArrowLeft, Loader2, SlidersHorizontal } from "lucide-react";

import {
    getRecoverySettings,
    listRecoveryEvents,
    previewRecoverySettings,
    saveRecoverySettings,
} from "@/lib/operations/api";
import { CatalyticApiError } from "@/lib/catalytic/http";
import { formatDate } from "@/lib/operations/format";
import RecoveryActivationCard from "@/components/operations/RecoveryActivationCard";
import RecoveryPreviewDialog from "@/components/operations/RecoveryPreviewDialog";
import RecoveryRulesEditor, { hasEnabledSource, pickRules, rulesEqual } from "@/components/operations/RecoveryRulesEditor";
import ScrapPriceControl from "@/components/operations/ScrapPriceControl";

const message = (error, fallback) => (error instanceof CatalyticApiError ? error.message : fallback);

const EVENT_LABEL = {
    UPDATE_SETTINGS: "Global settings changed",
    ACTIVATE: "Rules activated",
    DEACTIVATE: "Rules turned off",
    UPDATE_BATCH: "Batch rules changed",
    RESET_BATCH: "Batch reset to global",
    UPDATE_VEHICLE: "Vehicle rules changed",
    RESET_VEHICLE: "Vehicle reset to batch rules",
    BULK_EDIT: "Bulk edit",
};

function History({ refreshKey }) {
    const [items, setItems] = useState(null);
    useEffect(() => {
        listRecoveryEvents({ limit: 20 }).then((data) => setItems(data.items)).catch(() => setItems([]));
    }, [refreshKey]);
    if (!items || items.length === 0) return null;
    return (
        <section aria-label="Change history" className="rounded-2xl border border-white/10 bg-black/25 p-4">
            <h2 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-white/40">Recent changes</h2>
            <ul className="space-y-1 text-xs text-white/70">
                {items.map((event) => (
                    <li key={event.id} className="flex flex-wrap justify-between gap-x-3">
                        <span>
                            {EVENT_LABEL[event.action] || event.action}
                            {event.operations_batch_id && ` · Batch #${event.operations_batch_id}`}
                            {event.operations_batch_vehicle_id && ` · Vehicle ${event.operations_batch_vehicle_id}`}
                            {event.reason && ` · ${event.reason}`}
                        </span>
                        <span className="text-white/40">{formatDate(event.created_at)}</span>
                    </li>
                ))}
            </ul>
        </section>
    );
}

export default function RecoverySettingsPage() {
    const [settings, setSettings] = useState(null);
    const [draft, setDraft] = useState(null);
    const [error, setError] = useState("");
    const [preview, setPreview] = useState(null);
    const [previewing, setPreviewing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState("");
    const [historyKey, setHistoryKey] = useState(0);
    const running = useRef(false);

    const applyLoaded = useCallback((data) => {
        setSettings(data);
        setDraft(pickRules(data));
    }, []);

    const load = useCallback(async () => {
        try {
            applyLoaded(await getRecoverySettings());
            setError("");
        } catch (e) {
            setError(message(e, "Failed to load Recovery Settings"));
        }
    }, [applyLoaded]);

    useEffect(() => { load(); }, [load]);

    const openPreview = async () => {
        setPreviewing(true);
        setSaveError("");
        try {
            setPreview(await previewRecoverySettings(draft));
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
            applyLoaded(await saveRecoverySettings({ changes: draft, expectedVersion: settings.version }));
            setPreview(null);
            setHistoryKey((key) => key + 1);
            toast.success("Recovery Settings saved");
        } catch (e) {
            setSaveError(message(e, "Failed to save Recovery Settings"));
            if (e instanceof CatalyticApiError && e.status === 409) load();
        } finally {
            running.current = false;
            setSaving(false);
        }
    };

    return (
        <div className="space-y-4">
            <Link href="/operations" className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Operations
            </Link>
            <div>
                <h1 className="inline-flex items-center gap-2 text-xl font-black uppercase tracking-tight text-white/90">
                    <SlidersHorizontal className="h-5 w-5 text-emerald-400" /> Recovery Settings
                </h1>
                <p className="mt-1 text-xs text-white/40">
                    Defaults for every vehicle, unless a batch or vehicle has its own rules. These only choose among stored prices: nothing here starts a search.
                </p>
            </div>

            {!settings ? (
                <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-white/50">
                    {error ? (
                        <span className="flex w-full items-center justify-between gap-3 text-rose-300">
                            {error}
                            <button type="button" onClick={load} className="underline">Retry</button>
                        </span>
                    ) : <><Loader2 className="h-4 w-4 animate-spin" /> Loading…</>}
                </div>
            ) : (
                <>
                    <RecoveryActivationCard
                        settings={settings}
                        onChanged={(updated) => {
                            setSettings(updated);
                            setHistoryKey((key) => key + 1);
                        }}
                    />
                    <ScrapPriceControl />
                    <section aria-label="Global recovery rules" className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                        <RecoveryRulesEditor value={draft} onChange={setDraft} defaultPriority={settings.default_priority} idPrefix="global" />
                        <div className="mt-4 flex justify-end gap-2">
                            <button
                                type="button"
                                disabled={rulesEqual(draft, settings)}
                                onClick={() => setDraft(pickRules(settings))}
                                className="h-10 rounded-xl border border-white/15 px-4 text-xs font-bold text-white/70 disabled:opacity-40"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={rulesEqual(draft, settings) || !hasEnabledSource(draft) || previewing}
                                onClick={openPreview}
                                className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-500 px-4 text-xs font-bold text-black disabled:opacity-40"
                            >
                                {previewing && <Loader2 className="h-4 w-4 animate-spin" />}
                                Preview Changes
                            </button>
                        </div>
                    </section>
                    <History refreshKey={historyKey} />
                </>
            )}

            {preview && (
                <RecoveryPreviewDialog
                    title="Preview recovery changes"
                    preview={preview}
                    note={settings.rules_active ? null : "The rules are not active, so saving changes no total yet. These figures are what activation would show."}
                    applyLabel="Save Priority and Rules"
                    busy={saving}
                    error={saveError}
                    onApply={save}
                    onCancel={() => setPreview(null)}
                />
            )}
        </div>
    );
}
