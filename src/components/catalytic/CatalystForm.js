"use client";

import React, { useState } from "react";
import { Plus, Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Shared by "add a new catalyst" and "edit an existing catalyst while
// still DRAFT". Mirrors the backend's own submit-time rule client-side
// (app/catalytic/worker/services.py::submit_capture): a catalyst needs
// EITHER a stamped code OR an explicit "unreadable" flag — never both
// blank, and never forcing a worker to invent a code just to proceed.
export default function CatalystForm({ initial, onSubmit, onCancel, isSubmitting, submitLabel }) {
    const [positionCode, setPositionCode] = useState(initial?.position_code && initial.position_code !== "unknown" ? initial.position_code : "");
    const [code, setCode] = useState(initial?.physical_code_raw || "");
    const [unreadable, setUnreadable] = useState(Boolean(initial?.code_unreadable));
    const [notes, setNotes] = useState(initial?.notes || "");

    const codeOrUnreadableOk = unreadable || code.trim().length > 0;

    const submit = async (e) => {
        e.preventDefault();
        if (!codeOrUnreadableOk) return;
        const ok = await onSubmit({
            position_code: positionCode.trim() || "unknown",
            physical_code_raw: unreadable ? "" : code.trim().toUpperCase(),
            code_unreadable: unreadable,
            notes: notes.trim(),
        });
        if (ok && !initial) {
            setPositionCode("");
            setCode("");
            setUnreadable(false);
            setNotes("");
        }
    };

    return (
        <form onSubmit={submit} className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-4 space-y-3">
            <Input
                value={positionCode}
                onChange={(e) => setPositionCode(e.target.value)}
                placeholder="Position (e.g. front left)"
                className="h-12 rounded-xl bg-white/5 border-white/10"
            />
            <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                disabled={unreadable}
                placeholder="STAMPED CODE"
                className="h-14 rounded-xl bg-white/5 border-white/10 font-mono uppercase text-lg tracking-wider"
            />
            <label className="inline-flex items-center gap-2 text-xs text-white/50">
                <input
                    type="checkbox"
                    checked={unreadable}
                    onChange={(e) => {
                        setUnreadable(e.target.checked);
                        if (e.target.checked) setCode("");
                    }}
                    className="rounded"
                />
                Code unreadable / missing
            </label>
            {!codeOrUnreadableOk && (
                <p className="text-[11px] text-amber-400">Enter a stamped code, or check &quot;Code unreadable&quot;.</p>
            )}
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Note (optional)" className="h-12 rounded-xl bg-white/5 border-white/10" />
            <div className="flex gap-2">
                <Button type="submit" className="flex-1 h-12 rounded-xl" isLoading={isSubmitting} disabled={isSubmitting || !codeOrUnreadableOk}>
                    {initial ? <Check className="h-4 w-4 mr-1.5" /> : <Plus className="h-4 w-4 mr-1.5" />}
                    {submitLabel || (initial ? "Save" : "Add Catalyst")}
                </Button>
                {onCancel && (
                    <Button type="button" variant="outline" className="h-12 rounded-xl px-4 border-white/15" onClick={onCancel}>
                        <X className="h-4 w-4" />
                    </Button>
                )}
            </div>
        </form>
    );
}
