"use client";

import React from "react";

import CatalyticPriorityManager, { inFixedOrder } from "./CatalyticPriorityManager";
import InfoTip from "@/components/ui/InfoTip";
import { RECOVERY_COMPONENTS, RECOVERY_MODES } from "@/lib/operations/constants";

const heading = "mb-1.5 text-[10px] font-bold uppercase tracking-wider text-white/40";

// One batch's rule form. It holds no state of its own. K.60: the catalytic order is fixed
// and approximate prices always count (labelled), so only these keys are edited here.
export const RULE_KEYS = [
    "include_engine", "include_transmission", "include_scrap", "include_catalytic",
    "valuation_mode", "priority",
];

export function pickRules(values) {
    return Object.fromEntries(RULE_KEYS.map((key) => [key, key === "priority" ? inFixedOrder(values[key]) : values[key]]));
}

export function rulesEqual(a, b) {
    return JSON.stringify(pickRules(a)) === JSON.stringify(pickRules(b));
}

export function hasEnabledSource(rules) {
    return rules.priority.some((entry) => entry.enabled);
}

export default function RecoveryRulesEditor({ value, onChange, defaultPriority, disabled, idPrefix = "recovery" }) {
    const set = (key, next) => onChange({ ...value, [key]: next });
    return (
        <div className="space-y-4">
            <fieldset disabled={disabled}>
                <legend className={heading}>Vehicle estimate components</legend>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {RECOVERY_COMPONENTS.map(({ id, label }) => (
                        <label key={id} className="flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-3 text-sm text-white/85">
                            <input
                                type="checkbox"
                                checked={value[`include_${id}`]}
                                onChange={(e) => set(`include_${id}`, e.target.checked)}
                                className="h-4 w-4"
                            />
                            {label}
                        </label>
                    ))}
                </div>
            </fieldset>

            <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className={`${heading} mb-0 inline-flex items-center gap-1`}>
                        Catalytic sources
                        <InfoTip label="About catalytic sources">
                            Each vehicle uses ONE catalytic price: the first source in this fixed order with an eligible price, or the next one when a source has nothing. Exact: Our Database verified records, a CatDB result for this VIN. Inferred: CatDB Local, another vehicle&apos;s paid CatDB result for the same configuration. Estimate: Our Database figures borrowed from similar vehicles, EcoTrade Local catalog matches. EcoTrade matches that ignore the year are never used automatically. A CatDB price with a warning counts only its priced converters and marks the estimate Partial. It searches nothing: what gets searched is set in Catalytic Processing.
                        </InfoTip>
                    </span>
                    <button
                        type="button"
                        disabled={disabled}
                        onClick={() => set("priority", inFixedOrder(defaultPriority))}
                        className="text-xs font-bold text-white/60 underline disabled:opacity-40"
                    >
                        Turn all on
                    </button>
                </div>
                <CatalyticPriorityManager value={value.priority} onChange={(next) => set("priority", next)} disabled={disabled} />
                <p className="mt-1 text-[11px] text-white/35">
                    Turning a source off only stops it being used in estimates. Its results and searches stay as they are. A source this batch doesn&apos;t run is never used.
                </p>
            </div>

            <fieldset disabled={disabled}>
                <legend className={`${heading} inline-flex items-center gap-1`}>
                    Catalytic valuation mode
                    <InfoTip label="About LOW, MID and HIGH">
                        Each source stores a price range. LOW and HIGH are its two ends. MID is Our Database&apos;s and EcoTrade&apos;s expected price, or (LOW + HIGH) ÷ 2 for CatDB. A source with a single price uses it in every mode.
                    </InfoTip>
                </legend>
                <div className="flex gap-2">
                    {RECOVERY_MODES.map((mode) => (
                        <label key={mode} className={`flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border text-xs font-bold ${value.valuation_mode === mode ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-white/10 text-white/60"}`}>
                            <input
                                type="radio"
                                name={`${idPrefix}-mode`}
                                className="sr-only"
                                checked={value.valuation_mode === mode}
                                onChange={() => set("valuation_mode", mode)}
                            />
                            {mode}
                        </label>
                    ))}
                </div>
            </fieldset>
        </div>
    );
}
