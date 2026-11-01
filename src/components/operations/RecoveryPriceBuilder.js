"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Loader2, RotateCcw } from "lucide-react";

import { getVehicleRecovery, previewVehicleRecovery, resetVehicleRecovery, saveVehicleRecovery } from "@/lib/operations/api";
import { CatalyticApiError } from "@/lib/catalytic/http";
import {
    RECOVERY_COMPONENTS,
    RECOVERY_MATCH_LABEL,
    RECOVERY_MODES,
    RECOVERY_ORIGIN_LABEL,
    RECOVERY_SKIP_LABEL,
    RECOVERY_SOURCE_LABEL,
    RECOVERY_STATE_LABEL,
    RECOVERY_STATE_TONE,
} from "@/lib/operations/constants";
import { completenessMeta, componentLabel, formatMoney } from "@/lib/operations/format";
import StatusPill from "@/components/catalytic/StatusPill";
import { ConfirmDialog } from "@/components/catalytic/CatdbProcessingControls";

const PREVIEW_DELAY_MS = 120;
const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;
const message = (error, fallback) => (error instanceof CatalyticApiError ? error.message : fallback);

const RESET_ACTION = {
    title: "Reset to Batch Rules?",
    body: "Removes this vehicle's own rules, source choice and manual prices. Source prices and search results stay as they are.",
    confirm: "Reset",
};

function Origin({ value }) {
    return <span className="text-[10px] text-white/35">{RECOVERY_ORIGIN_LABEL[value] || value}</span>;
}

function ComponentRow({ component, label, rate, draftManual, onInclude, onResetInclude, onManual }) {
    const [editing, setEditing] = useState(false);
    const hasDraftManual = draftManual !== undefined;
    const text = hasDraftManual ? (draftManual ?? "") : "";
    const showEditor = editing || (hasDraftManual && draftManual !== null);
    const invalid = showEditor && text !== "" && !MONEY_PATTERN.test(text);
    return (
        <div className="border-b border-white/5 py-2 last:border-b-0">
            <div className="flex items-center gap-2">
                <input
                    type="checkbox"
                    aria-label={`Include ${label}`}
                    checked={component.included}
                    onChange={(e) => onInclude(e.target.checked)}
                    className="h-4 w-4 shrink-0"
                />
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2">
                        <span className="text-sm font-bold text-white/85">{label}</span>
                        <Origin value={component.included_origin} />
                        {component.included_origin === "VEHICLE" && (
                            <button type="button" aria-label={`Use the batch rule for ${label}`} onClick={onResetInclude} className="text-white/40 hover:text-white">
                                <RotateCcw className="h-3 w-3" />
                            </button>
                        )}
                    </div>
                    <div className="break-words text-[11px] text-white/40">
                        {RECOVERY_SOURCE_LABEL[component.source] || component.source || "No source"}
                        {component.name === "scrap" && component.source === "GLOBAL_SCRAP_PRICE" && rate != null && ` · $${Number(rate)}/lb`}
                        {component.is_manual && component.automatic_price != null && ` · automatic ${formatMoney(component.automatic_price)}`}
                    </div>
                </div>
                <div className="shrink-0 text-right">
                    <div className={`text-sm font-bold ${component.included ? "text-white/90" : "text-white/35 line-through"}`}>{formatMoney(component.effective_price)}</div>
                    <StatusPill label={component.is_manual ? "Manual override" : RECOVERY_STATE_LABEL[component.state]} tone={component.is_manual ? "info" : RECOVERY_STATE_TONE[component.state]} />
                </div>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 pl-6">
                {showEditor ? (
                    <>
                        <label htmlFor={`manual-${component.name}`} className="sr-only">Manual {label} price</label>
                        <input
                            id={`manual-${component.name}`}
                            inputMode="decimal"
                            value={text}
                            placeholder="Manual price"
                            onChange={(e) => onManual(e.target.value)}
                            className="h-9 w-28 rounded-lg border border-white/10 bg-white/5 px-2 text-base text-white sm:text-xs"
                        />
                        <button type="button" onClick={() => { setEditing(false); onManual(null); }} className="text-xs font-bold text-white/60 underline">Remove</button>
                        {invalid && <span role="alert" className="text-[11px] text-rose-300">Enter dollars and cents, 0 or more</span>}
                    </>
                ) : (
                    <>
                        <button type="button" onClick={() => setEditing(true)} className="text-xs font-bold text-white/60 underline">{component.is_manual ? "Edit Price" : "Override"}</button>
                        {component.is_manual && <button type="button" onClick={() => onManual(null)} className="text-xs font-bold text-white/60 underline">Restore Automatic</button>}
                    </>
                )}
            </div>
        </div>
    );
}

function SourceOption({ name, checked, onSelect, disabled, title, detail, warning }) {
    return (
        <label className={`flex min-h-10 items-start gap-2 rounded-lg border px-2 py-1.5 text-xs ${checked ? "border-emerald-500/40 bg-emerald-500/[0.06]" : "border-white/10"} ${disabled ? "opacity-40" : ""}`}>
            <input type="radio" name={name} className="mt-0.5 h-4 w-4 shrink-0" checked={checked} disabled={disabled} onChange={onSelect} />
            <span className="min-w-0 flex-1">
                <span className="font-bold text-white/85">{title}</span>
                {detail && <span className="block text-[11px] text-white/45">{detail}</span>}
                {warning && <span className="block break-words text-[11px] text-amber-300/90">{warning}</span>}
            </span>
        </label>
    );
}

function optionDetail(option, mode) {
    if (!option.available) return option.status === "NOT_REQUESTED" ? "Not searched" : "No result";
    const range = option.low != null || option.high != null ? `${formatMoney(option.low)}–${formatMoney(option.high)}` : null;
    const value = option.value != null ? `${formatMoney(option.value)} ${mode}` : `No ${mode} price`;
    const parts = [value, range, RECOVERY_MATCH_LABEL[option.match_type] || option.match_type, !option.enabled_in_priority && "Off in priority"];
    return parts.filter(Boolean).join(" · ");
}

export default function RecoveryPriceBuilder({ batchId, vehicleId, onSaved }) {
    const [view, setView] = useState(null);
    const [draft, setDraft] = useState({});
    const [calculating, setCalculating] = useState(false);
    const [loadError, setLoadError] = useState("");
    const [saving, setSaving] = useState(false);
    const [confirmingReset, setConfirmingReset] = useState(false);
    const [reason, setReason] = useState("");
    const latest = useRef(0);
    const running = useRef(false);
    const timer = useRef(null);

    const load = useCallback(async () => {
        try {
            setView(await getVehicleRecovery(batchId, vehicleId));
            setLoadError("");
        } catch (e) {
            setLoadError(message(e, "Failed to load the Recovery Price Builder"));
        }
    }, [batchId, vehicleId]);

    useEffect(() => {
        load();
        return () => clearTimeout(timer.current);
    }, [load]);

    // The total is always the backend's: each change asks it again, and a slower earlier
    // answer never replaces a newer one.
    const change = (patch) => {
        const next = { ...draft, ...patch };
        setDraft(next);
        const request = ++latest.current;
        clearTimeout(timer.current);
        const ready = Object.entries(next).every(([key, value]) => !key.endsWith("_manual_price") || value === null || MONEY_PATTERN.test(value));
        if (!ready) {
            setCalculating(false);
            return;
        }
        setCalculating(true);
        timer.current = setTimeout(async () => {
            try {
                const preview = await previewVehicleRecovery(batchId, vehicleId, next);
                if (request === latest.current) setView(preview);
            } catch (e) {
                if (request === latest.current) toast.error(message(e, "Failed to calculate the total"));
            } finally {
                if (request === latest.current) setCalculating(false);
            }
        }, PREVIEW_DELAY_MS);
    };

    const discard = () => {
        latest.current += 1;
        clearTimeout(timer.current);
        setDraft({});
        setReason("");
        setCalculating(false);
        load();
    };

    const finish = (updated, text) => {
        latest.current += 1;
        setView(updated);
        setDraft({});
        setReason("");
        setCalculating(false);
        toast.success(text);
        onSaved?.();
    };

    const onError = (e, fallback) => {
        toast.error(message(e, fallback));
        if (e instanceof CatalyticApiError && e.status === 409) discard();
    };

    const save = async () => {
        if (running.current) return;
        running.current = true;
        setSaving(true);
        try {
            finish(await saveVehicleRecovery(batchId, vehicleId, { changes: draft, expectedVersion: view.version, reason: reason.trim() || undefined }), "Vehicle recovery saved");
        } catch (e) {
            onError(e, "Failed to save the vehicle's recovery rules");
        } finally {
            running.current = false;
            setSaving(false);
        }
    };

    const reset = async () => {
        if (running.current) return;
        running.current = true;
        setSaving(true);
        try {
            finish(await resetVehicleRecovery(batchId, vehicleId, { expectedVersion: view.version }), "Vehicle now follows the batch rules");
        } catch (e) {
            onError(e, "Failed to reset the vehicle's recovery rules");
        } finally {
            running.current = false;
            setSaving(false);
            setConfirmingReset(false);
        }
    };

    if (!view) {
        return (
            <section aria-label="Recovery Price Builder" className="mb-4 rounded-xl border border-white/10 bg-black/25 p-4 text-sm text-white/50">
                {loadError ? (
                    <span className="flex items-center justify-between gap-3 text-rose-300">
                        {loadError}
                        <button type="button" onClick={load} className="underline">Retry</button>
                    </span>
                ) : "Loading Recovery Price Builder…"}
            </section>
        );
    }

    const catalytic = view.catalytic;
    const completeness = completenessMeta(view.completeness);
    const dirty = Object.keys(draft).length > 0;
    const invalid = Object.entries(draft).some(([key, value]) => key.endsWith("_manual_price") && value !== null && !MONEY_PATTERN.test(value));
    const selected = catalytic.selected_source;
    const selectedOption = catalytic.options.find((option) => option.source === selected);
    const groupName = `recovery-source-${vehicleId}`;
    const modeName = `recovery-mode-${vehicleId}`;

    return (
        <section aria-label="Recovery Price Builder" className="mb-4 rounded-xl border border-white/10 bg-black/25 p-3 sm:p-4">
            <div className="mb-1 flex items-center justify-between gap-2">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-white/40">Recovery Price Builder</h3>
                <StatusPill label={completeness.label} tone={completeness.tone} />
            </div>
            {!view.rules_active && (
                <p className="mb-2 text-[11px] text-amber-200/80">The rules are not active yet. What you save here applies once they are activated in Recovery Settings.</p>
            )}

            {RECOVERY_COMPONENTS.map(({ id, label }) => (
                <ComponentRow
                    key={id}
                    component={view.components.find((component) => component.name === id)}
                    label={label}
                    rate={view.scrap_rate}
                    draftManual={draft[`${id}_manual_price`]}
                    onInclude={(included) => change({ [`include_${id}`]: included })}
                    onResetInclude={() => change({ [`include_${id}`]: null })}
                    onManual={(value) => change({ [`${id}_manual_price`]: value === "" ? null : value })}
                />
            ))}

            <div className="flex items-baseline justify-between gap-3 border-t border-white/20 pt-2">
                <span className="text-xs font-black uppercase tracking-wider text-white/60">Recovery Total</span>
                <span data-testid="recovery-total" className={`text-xl font-black text-emerald-300 ${calculating ? "opacity-50" : ""}`} aria-busy={calculating}>
                    {formatMoney(view.recovery_total)}
                </span>
            </div>
            <p className="text-right text-[11px] text-white/40">
                {view.missing_components.length > 0
                    ? `Incomplete: missing ${view.missing_components.map(componentLabel).join(", ")}`
                    : "Missing components: None"}
            </p>

            <fieldset className="mt-3">
                <legend className="mb-1 text-[10px] font-bold uppercase tracking-wider text-white/40">Catalytic price source</legend>
                <div className="space-y-1">
                    <SourceOption
                        name={groupName}
                        checked={selected == null}
                        onSelect={() => change({ catalytic_source: null })}
                        title="Auto: use priority rules"
                        detail={selected == null && (RECOVERY_SOURCE_LABEL[catalytic.effective_source] || catalytic.effective_source)}
                    />
                    {catalytic.options.map((option) => (
                        <SourceOption
                            key={option.source}
                            name={groupName}
                            checked={selected === option.source}
                            disabled={!option.available}
                            onSelect={() => change({ catalytic_source: option.source })}
                            title={RECOVERY_SOURCE_LABEL[option.source]}
                            detail={optionDetail(option, catalytic.valuation_mode)}
                            warning={option.uncertain && `Needs review, so never used automatically: ${option.uncertain}`}
                        />
                    ))}
                    <SourceOption name={groupName} checked={selected === "NONE"} onSelect={() => change({ catalytic_source: "NONE" })} title="None" />
                </div>
                {selectedOption?.candidates?.length > 1 && (
                    <div className="mt-2">
                        <label htmlFor={`candidate-${vehicleId}`} className="text-[11px] text-white/50">Converter</label>
                        <select
                            id={`candidate-${vehicleId}`}
                            value={catalytic.candidate_code || ""}
                            onChange={(e) => change({ catalytic_candidate_code: e.target.value || null })}
                            className="mt-0.5 h-10 w-full rounded-lg border border-white/10 bg-[#0b0d12] px-2 text-xs text-white"
                        >
                            <option value="">Catalog spread of {selectedOption.candidate_count} converters, not the fitted part</option>
                            {selectedOption.candidates.map((candidate) => (
                                <option key={candidate.code} value={candidate.code}>
                                    {candidate.code}: {formatMoney(candidate.price_low)}–{formatMoney(candidate.price_high)}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
                {(catalytic.approximate || catalytic.uncertain) && catalytic.effective_source !== "MANUAL" && (
                    <p className="mt-1 text-[11px] font-bold text-amber-300">{catalytic.uncertain ? "Flagged price chosen for this vehicle" : "Estimated match, not an exact one"}</p>
                )}
                {catalytic.reason && <p className="mt-1 text-[11px] text-amber-300/90">{catalytic.reason}</p>}
                {catalytic.skipped.length > 0 && (
                    <details className="mt-1 text-[11px] text-white/45">
                        <summary className="cursor-pointer">Why other sources were passed over</summary>
                        <ul className="mt-1 list-inside list-disc">
                            {catalytic.skipped.map((entry) => (
                                <li key={entry.source}>{RECOVERY_SOURCE_LABEL[entry.source]}: {RECOVERY_SKIP_LABEL[entry.reason] || entry.reason}</li>
                            ))}
                        </ul>
                    </details>
                )}
            </fieldset>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <fieldset>
                    <legend className="mb-1 text-[10px] font-bold uppercase tracking-wider text-white/40">
                        Valuation mode <Origin value={catalytic.valuation_mode_origin} />
                    </legend>
                    <div className="flex items-center gap-1">
                        {RECOVERY_MODES.map((mode) => (
                            <label key={mode} className={`flex h-9 w-14 items-center justify-center rounded-lg border text-xs font-bold ${catalytic.valuation_mode === mode ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-white/10 text-white/60"}`}>
                                <input type="radio" name={modeName} className="sr-only" checked={catalytic.valuation_mode === mode} onChange={() => change({ valuation_mode: mode })} />
                                {mode}
                            </label>
                        ))}
                        {catalytic.valuation_mode_origin === "VEHICLE" && (
                            <button type="button" aria-label="Use the batch valuation mode" onClick={() => change({ valuation_mode: null })} className="ml-1 text-white/40 hover:text-white">
                                <RotateCcw className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                </fieldset>
                <label className="flex items-center gap-2 text-xs text-white/75">
                    <input type="checkbox" className="h-4 w-4" checked={catalytic.allow_approximate} onChange={(e) => change({ allow_approximate: e.target.checked })} />
                    Allow approximate matches
                    <Origin value={catalytic.allow_approximate_origin} />
                </label>
            </div>

            {dirty && (
                <div className="mt-3">
                    <label htmlFor={`recovery-reason-${vehicleId}`} className="sr-only">Reason, optional</label>
                    <input
                        id={`recovery-reason-${vehicleId}`}
                        value={reason}
                        maxLength={500}
                        placeholder="Reason, optional"
                        onChange={(e) => setReason(e.target.value)}
                        className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-2 text-base text-white sm:text-xs"
                    />
                </div>
            )}
            <div className="mt-3 flex flex-wrap justify-end gap-2">
                <button type="button" disabled={saving} onClick={() => setConfirmingReset(true)} className="h-10 rounded-xl border border-white/15 px-3 text-xs font-bold text-white/70 disabled:opacity-40">
                    Reset to Batch Rules
                </button>
                {dirty && <button type="button" disabled={saving} onClick={discard} className="h-10 rounded-xl border border-white/15 px-3 text-xs font-bold text-white/70">Discard</button>}
                <button type="button" disabled={!dirty || invalid || saving || calculating} onClick={save} className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-500 px-4 text-xs font-bold text-black disabled:opacity-40">
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    Save
                </button>
            </div>
            {confirmingReset && <ConfirmDialog action={RESET_ACTION} busy={saving} onConfirm={reset} onClose={() => setConfirmingReset(false)} />}
        </section>
    );
}
