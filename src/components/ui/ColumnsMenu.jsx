"use client";

import React, { useEffect, useRef, useState } from "react";
import { CheckSquare, Settings2, Square } from "lucide-react";

// The Columns choice, as in Parts Analysis: a button with a checklist. Show All,
// Hide All and Reset to Default; columns marked required can't be hidden.
export default function ColumnsMenu({ columns, isVisible, onToggle, onShowAll, onHideAll, onReset }) {
    const [open, setOpen] = useState(false);
    const box = useRef(null);
    const shown = columns.filter(isVisible).length;

    useEffect(() => {
        if (!open) return undefined;
        const outside = (event) => { if (!box.current?.contains(event.target)) setOpen(false); };
        const escape = (event) => {
            if (event.key !== "Escape") return;
            event.stopPropagation();
            setOpen(false);
        };
        document.addEventListener("pointerdown", outside);
        document.addEventListener("keydown", escape, true);
        return () => {
            document.removeEventListener("pointerdown", outside);
            document.removeEventListener("keydown", escape, true);
        };
    }, [open]);

    const action = "-my-1 px-1 py-1 text-[11px] font-bold uppercase text-emerald-400 hover:text-emerald-300";
    return (
        <div ref={box} className="relative">
            <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpen((value) => !value)}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.04] px-3 text-xs font-bold text-white/80 hover:bg-white/10 sm:h-9"
            >
                <Settings2 className="h-4 w-4" /> Columns ({shown}/{columns.length})
            </button>
            {open && (
                <div
                    role="dialog"
                    aria-label="Visible columns"
                    className="absolute right-0 top-full z-50 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-white/10 bg-[#0c0e13] p-2 shadow-2xl"
                >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-white/5 px-2 pb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-white/60">Visible Columns</span>
                        <span className="flex gap-2">
                            <button type="button" className={action} onClick={onShowAll}>Show All</button>
                            <button type="button" className={action} onClick={onHideAll}>Hide All</button>
                            <button type="button" className={action} onClick={onReset}>Reset to Default</button>
                        </span>
                    </div>
                    <div className="max-h-72 space-y-1 overflow-y-auto">
                        {columns.map((column) => {
                            const on = isVisible(column);
                            return (
                                <button
                                    key={column.id}
                                    type="button"
                                    role="menuitemcheckbox"
                                    aria-checked={on}
                                    disabled={column.required}
                                    onClick={() => onToggle(column.id)}
                                    className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-white/80 hover:bg-white/5 disabled:opacity-50 sm:min-h-0"
                                >
                                    {on ? <CheckSquare className="h-4 w-4 shrink-0 text-emerald-500" /> : <Square className="h-4 w-4 shrink-0 text-white/20" />}
                                    <span className="min-w-0 break-words">{column.label}{column.required ? " (always shown)" : ""}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
