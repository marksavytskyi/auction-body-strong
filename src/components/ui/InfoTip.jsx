"use client";

import React, { useId, useState } from "react";
import { Info } from "lucide-react";

// Phase K.52 — a short explanation behind an (i). Opens on tap or click as well as
// hover, so it works on touch screens; the text is also the button's accessible description.
export default function InfoTip({ label, children }) {
    const [open, setOpen] = useState(false);
    const id = useId();
    return (
        <span className="relative inline-flex align-middle">
            <button
                type="button"
                aria-label={label}
                aria-expanded={open}
                aria-describedby={open ? id : undefined}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
                onBlur={() => setOpen(false)}
                className="inline-flex h-6 w-6 items-center justify-center rounded-full text-white/40 hover:text-white/80"
            >
                <Info className="h-3.5 w-3.5" />
            </button>
            {open && (
                <span id={id} role="tooltip"
                    className="absolute left-0 top-7 z-30 w-64 max-w-[80vw] rounded-xl border border-white/15 bg-[#0b0d12] p-2.5 text-[11px] font-normal normal-case tracking-normal text-white/75 shadow-xl">
                    {children}
                </span>
            )}
        </span>
    );
}
