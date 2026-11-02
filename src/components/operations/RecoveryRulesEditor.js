"use client";

import React from "react";

import CatalyticPriorityManager from "./CatalyticPriorityManager";
import { RECOVERY_COMPONENTS, RECOVERY_MODES } from "@/lib/operations/constants";

const heading = "mb-1.5 text-[10px] font-bold uppercase tracking-wider text-white/40";

// One batch's rule form. It holds no state of its own.
export const RULE_KEYS = [
    "include_engine", "include_transmission", "include_scrap", "include_catalytic",
    "allow_approximate", "valuation_mode", "priority",
];

export function pickRules(values) {
    return Object.fromEntries(RULE_KEYS.map((key) => [key, values[key]]));
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
                <legend className={heading}>Recovery components</legend>
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
                    <span className={`${heading} mb-0`}>Catalytic price priority</span>
                    <button
                        type="button"
                        disabled={disabled}
                        onClick={() => set("priority", defaultPriority)}
                        className="text-xs font-bold text-white/60 underline disabled:opacity-40"
                    >
                        Reset to Default
                    </button>
                </div>
                <CatalyticPriorityManager value={value.priority} onChange={(next) => set("priority", next)} disabled={disabled} />
                <p className="mt-1 text-[11px] text-white/35">
                    Turning a source off only stops automatic valuation. Its results and searches stay as they are.
                </p>
            </div>

            <fieldset disabled={disabled}>
                <legend className={heading}>Matching</legend>
                <label className="flex items-start gap-2 text-sm text-white/85">
                    <input
                        type="checkbox"
                        checked={value.allow_approximate}
                        onChange={(e) => set("allow_approximate", e.target.checked)}
                        className="mt-0.5 h-4 w-4 shrink-0"
                    />
                    <span>
                        Allow approximate model matches in Recovery Total
                        <span className="block text-[11px] text-white/40">
                            A catalog lists every converter known for a model, not the fitted one. These values are labelled as estimated.
                        </span>
                    </span>
                </label>
            </fieldset>

            <fieldset disabled={disabled}>
                <legend className={heading}>Catalytic valuation mode</legend>
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
