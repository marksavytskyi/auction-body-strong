"use client";

import React from "react";

import { PAGE_SIZE_OPTIONS, pageSizeLabel, parsePageSize } from "@/lib/pagination";

// The rows-per-page choice every paginated table shares, with All last.
export default function PageSizeSelect({ value, onChange, options = PAGE_SIZE_OPTIONS, disabled = false, label = "Rows per page", className = "" }) {
    return (
        <label className={["inline-flex items-center gap-2 whitespace-nowrap", className].join(" ")}>
            <span>{label}</span>
            <select
                aria-label={label}
                value={String(value)}
                disabled={disabled}
                onChange={(event) => {
                    const next = parsePageSize(event.target.value, options);
                    if (next !== null) onChange(next);
                }}
                className="h-10 min-w-[4.5rem] rounded-lg border border-white/10 bg-[#090b10] px-2 text-sm text-white outline-none focus:border-emerald-500/50 disabled:opacity-40 sm:h-8 sm:text-xs"
            >
                {options.map((option) => (
                    <option key={String(option)} value={String(option)} className="bg-[#090b10]">
                        {pageSizeLabel(option)}
                    </option>
                ))}
            </select>
        </label>
    );
}
