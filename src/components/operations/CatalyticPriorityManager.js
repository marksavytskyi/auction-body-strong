"use client";

import React, { useRef, useState } from "react";
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";

import { RECOVERY_SOURCE_LABEL } from "@/lib/operations/constants";

function moved(list, from, to) {
    if (to < 0 || to >= list.length || from === to) return list;
    const next = [...list];
    const [entry] = next.splice(from, 1);
    next.splice(to, 0, entry);
    return next;
}

// Controlled: the parent holds the draft and decides when to save. Drag with a mouse, arrow
// keys on the handle, or Move Up and Move Down, which also serve touch screens.
export default function CatalyticPriorityManager({ value, onChange, disabled }) {
    const [dragging, setDragging] = useState(null);
    const [announcement, setAnnouncement] = useState("");
    const handles = useRef({});

    const move = (from, to) => {
        const next = moved(value, from, to);
        if (next === value) return;
        onChange(next);
        setAnnouncement(`${RECOVERY_SOURCE_LABEL[value[from].source]} moved to position ${to + 1}`);
    };

    const onHandleKey = (event, index) => {
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
        event.preventDefault();
        const to = index + (event.key === "ArrowUp" ? -1 : 1);
        const source = value[index].source;
        move(index, to);
        requestAnimationFrame(() => handles.current[source]?.focus());
    };

    return (
        <div>
            <ol className="space-y-1.5" aria-label="Catalytic price priority">
                {value.map((entry, index) => (
                    <li
                        key={entry.source}
                        data-testid={`priority-${entry.source}`}
                        draggable={!disabled}
                        onDragStart={() => setDragging(index)}
                        onDragEnd={() => setDragging(null)}
                        onDragOver={(e) => {
                            e.preventDefault();
                            if (dragging !== null && dragging !== index) {
                                move(dragging, index);
                                setDragging(index);
                            }
                        }}
                        className={`flex items-center gap-2 rounded-xl border p-2 ${dragging === index ? "border-emerald-500/40 bg-emerald-500/[0.06]" : "border-white/10 bg-black/25"}`}
                    >
                        <button
                            type="button"
                            ref={(node) => { handles.current[entry.source] = node; }}
                            disabled={disabled}
                            aria-label={`Reorder ${RECOVERY_SOURCE_LABEL[entry.source]}, position ${index + 1}. Use the arrow keys.`}
                            onKeyDown={(e) => onHandleKey(e, index)}
                            className="hidden h-8 w-6 shrink-0 cursor-grab items-center justify-center text-white/35 sm:flex"
                        >
                            <GripVertical className="h-4 w-4" />
                        </button>
                        <span className="w-4 shrink-0 text-center text-xs font-black text-white/50">{index + 1}</span>
                        <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-white/85">
                            <input
                                type="checkbox"
                                checked={entry.enabled}
                                disabled={disabled}
                                onChange={(e) => onChange(value.map((other) => (other.source === entry.source ? { ...other, enabled: e.target.checked } : other)))}
                                className="h-4 w-4 shrink-0"
                            />
                            <span className="truncate">{RECOVERY_SOURCE_LABEL[entry.source]}</span>
                        </label>
                        <button
                            type="button"
                            aria-label={`Move ${RECOVERY_SOURCE_LABEL[entry.source]} up`}
                            disabled={disabled || index === 0}
                            onClick={() => move(index, index - 1)}
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 text-white/70 disabled:opacity-25 sm:h-9 sm:w-9"
                        >
                            <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                            type="button"
                            aria-label={`Move ${RECOVERY_SOURCE_LABEL[entry.source]} down`}
                            disabled={disabled || index === value.length - 1}
                            onClick={() => move(index, index + 1)}
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 text-white/70 disabled:opacity-25 sm:h-9 sm:w-9"
                        >
                            <ChevronDown className="h-4 w-4" />
                        </button>
                    </li>
                ))}
            </ol>
            <span role="status" aria-live="polite" className="sr-only">{announcement}</span>
            {value.every((entry) => !entry.enabled) && (
                <p role="alert" className="mt-2 text-xs text-rose-300">Enable at least one source, or exclude the Catalytic Converter component instead.</p>
            )}
        </div>
    );
}
