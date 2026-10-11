"use client";

import React from "react";

// Shared small status pill — same visual pattern as MachineStatusBadge in
// cats/admin/catdb/page.js, generalized so copart-import vehicle status,
// CatDB batch status, and batch-item status all read consistently.
const TONE_CLASS = {
    neutral: "border-white/15 bg-white/5 text-white/50",
    info: "border-sky-500/30 bg-sky-500/10 text-sky-300",
    progress: "border-violet-500/30 bg-violet-500/10 text-violet-300",
    success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    warning: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    danger: "border-rose-500/30 bg-rose-500/10 text-rose-300",
};

export default function StatusPill({ label, tone = "neutral", className = "" }) {
    const toneClass = TONE_CLASS[tone] || TONE_CLASS.neutral;
    return (
        <span
            className={[
                "inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap",
                toneClass,
                className,
            ].join(" ")}
        >
            {label}
        </span>
    );
}
