"use client";

import React, { useId, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import StatusPill from "@/components/catalytic/StatusPill";

// Phase K.52 — one collapsible card for Batch Details. Closed by default; the header
// carries a one-line summary and a status pill, so running work and failures stay
// visible while the section is closed.
export default function CollapsibleSection({ title, icon: Icon, summary, status, defaultOpen = false, children, label }) {
    const [open, setOpen] = useState(defaultOpen);
    const bodyId = useId();
    return (
        <section aria-label={label || title} className="rounded-2xl border border-white/10 bg-white/[0.02]">
            <button
                type="button"
                aria-expanded={open}
                aria-controls={bodyId}
                onClick={() => setOpen((v) => !v)}
                className="flex min-h-11 w-full flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2 text-left"
            >
                {open ? <ChevronDown className="h-4 w-4 shrink-0 text-white/60" /> : <ChevronRight className="h-4 w-4 shrink-0 text-white/60" />}
                {Icon && <Icon className="h-4 w-4 shrink-0 text-emerald-400" />}
                <span className="text-sm font-bold text-white/85">{title}</span>
                {summary && <span className="min-w-0 text-xs text-white/55">{summary}</span>}
                {status && <span className="ml-auto"><StatusPill label={status.label} tone={status.tone} /></span>}
            </button>
            {open && <div id={bodyId} className="space-y-3 px-4 pb-4">{children}</div>}
        </section>
    );
}
