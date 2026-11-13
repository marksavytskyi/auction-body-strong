"use client";

import React from "react";

import { RECOVERY_SOURCE_LABEL } from "@/lib/operations/constants";

// K.60 — the catalytic order is fixed for every batch (owner decision):
// Our Database > CatDB VIN > CatDB Local > EcoTrade Local. A batch can only switch a
// source on or off. Controlled: the parent holds the draft and decides when to save.
export const FIXED_SOURCE_ORDER = ["OUR_DATABASE", "CATDB_VIN", "CATDB_LOCAL", "ECOTRADE_LOCAL"];

export function inFixedOrder(priority) {
    const enabled = Object.fromEntries((priority || []).map((entry) => [entry.source, entry.enabled]));
    return FIXED_SOURCE_ORDER.map((source) => ({ source, enabled: enabled[source] ?? true }));
}

export default function CatalyticPriorityManager({ value, onChange, disabled }) {
    const ordered = inFixedOrder(value);
    return (
        <div>
            <ol className="space-y-1.5" aria-label="Catalytic price priority">
                {ordered.map((entry, index) => (
                    <li
                        key={entry.source}
                        data-testid={`priority-${entry.source}`}
                        className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/25 p-2"
                    >
                        <span className="w-4 shrink-0 text-center text-xs font-black text-white/50">{index + 1}</span>
                        <label className="flex min-h-8 min-w-0 flex-1 items-center gap-2 text-sm text-white/85">
                            <input
                                type="checkbox"
                                checked={entry.enabled}
                                disabled={disabled}
                                onChange={(e) => onChange(ordered.map((other) => (other.source === entry.source ? { ...other, enabled: e.target.checked } : other)))}
                                className="h-4 w-4 shrink-0"
                            />
                            <span className="truncate">{RECOVERY_SOURCE_LABEL[entry.source]}</span>
                        </label>
                    </li>
                ))}
            </ol>
            {ordered.every((entry) => !entry.enabled) && (
                <p role="alert" className="mt-2 text-xs text-rose-300">Enable at least one source, or exclude the Catalytic Converter component instead.</p>
            )}
        </div>
    );
}
