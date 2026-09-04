"use client";

import React from "react";
import { ShieldCheck, Database, HelpCircle, PencilLine, TriangleAlert } from "lucide-react";

const CONFIDENCE_STYLE = {
    VERY_HIGH: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    HIGH: "border-emerald-500/25 bg-emerald-500/[0.07] text-emerald-300",
    MEDIUM: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    LOW: "border-rose-500/30 bg-rose-500/10 text-rose-300",
    UNKNOWN: "border-white/15 bg-white/5 text-white/50",
};

const CONFIDENCE_LABEL = {
    VERY_HIGH: "Very High",
    HIGH: "High",
    MEDIUM: "Medium",
    LOW: "Low",
    UNKNOWN: "Unknown",
};

export function ConfidenceBadge({ confidence, className = "" }) {
    const key = CONFIDENCE_STYLE[confidence] ? confidence : "UNKNOWN";
    return (
        <span
            className={[
                "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border backdrop-blur-md whitespace-nowrap",
                CONFIDENCE_STYLE[key],
                className,
            ].join(" ")}
        >
            {key === "LOW" || key === "UNKNOWN" ? <TriangleAlert className="h-3 w-3" /> : null}
            {CONFIDENCE_LABEL[key]}
        </span>
    );
}

const SOURCE_TONE_STYLE = {
    verified: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    external: "border-sky-500/25 bg-sky-500/[0.08] text-sky-300",
    manual: "border-violet-500/25 bg-violet-500/[0.08] text-violet-300",
    unknown: "border-white/15 bg-white/5 text-white/45",
};

const SOURCE_TONE_ICON = {
    verified: ShieldCheck,
    external: Database,
    manual: PencilLine,
    unknown: HelpCircle,
};

export function SourceBadge({ source, className = "" }) {
    if (!source) return null;
    const tone = SOURCE_TONE_STYLE[source.tone] ? source.tone : "unknown";
    const Icon = SOURCE_TONE_ICON[tone];

    return (
        <span
            title={source.hint || undefined}
            className={[
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap",
                SOURCE_TONE_STYLE[tone],
                className,
            ].join(" ")}
        >
            <Icon className="h-3 w-3" />
            {source.label}
        </span>
    );
}
