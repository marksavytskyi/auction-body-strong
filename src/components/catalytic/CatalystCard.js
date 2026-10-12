"use client";

import React, { useState } from "react";
import { Trash2, Pencil, AlertTriangle } from "lucide-react";

import { catalystHasCodeInfo } from "@/lib/catalytic/workerCaptures";
import CatalystForm from "./CatalystForm";
import PhotoStrip from "./PhotoStrip";

function humanizePosition(code) {
    return String(code || "").replace(/_/g, " ");
}

// One physical catalyst, one card — always. Two catalysts that happen to
// share an identical stamped code are two separate cards with two
// separate ids; nothing here ever merges them (see workerCaptures.js /
// the backend's own guarantee that identical codes never collapse into
// one trusted observation).
export default function CatalystCard({
    index,
    captureId,
    catalyst,
    isDraft,
    pendingPhotos,
    onPendingChange,
    onChanged,
    onUpdate,
    onDelete,
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const hasCodeInfo = catalystHasCodeInfo(catalyst);

    const handleSave = async (payload) => {
        setIsSaving(true);
        try {
            const ok = await onUpdate(catalyst.id, payload);
            if (ok) setIsEditing(false); // a failed save leaves the form open with the worker's edits intact
            return ok;
        } finally {
            setIsSaving(false);
        }
    };

    if (isEditing) {
        return (
            <div id={`catalyst-${catalyst.id}`} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <CatalystForm initial={catalyst} onSubmit={handleSave} onCancel={() => setIsEditing(false)} isSubmitting={isSaving} submitLabel="Save" />
            </div>
        );
    }

    return (
        <div id={`catalyst-${catalyst.id}`} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="text-[10px] text-white/30 uppercase tracking-wider">Catalyst #{index + 1}</div>
                    <div className="font-bold text-white/90 capitalize">{humanizePosition(catalyst.position_code)}</div>
                    <div className="text-sm text-white/60 font-mono mt-0.5">
                        {catalyst.code_unreadable ? (
                            <span className="italic text-white/35">code unreadable</span>
                        ) : (
                            catalyst.physical_code_raw || "—"
                        )}
                    </div>
                    {catalyst.notes && <div className="text-[11px] text-white/35 italic mt-1">{catalyst.notes}</div>}
                </div>
                {isDraft && (
                    <div className="flex items-center gap-1">
                        <button type="button" aria-label="Edit catalyst" onClick={() => setIsEditing(true)} className="text-white/30 hover:text-emerald-400 p-1">
                            <Pencil className="h-4 w-4" />
                        </button>
                        <button type="button" aria-label="Delete catalyst" onClick={() => onDelete(catalyst.id)} className="text-white/30 hover:text-rose-400 p-1">
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </div>
                )}
            </div>

            {isDraft && !hasCodeInfo && (
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5" /> Add a stamped code, or mark it unreadable
                </div>
            )}

            <PhotoStrip
                captureId={captureId}
                catalyst={catalyst}
                isDraft={isDraft}
                pending={pendingPhotos || []}
                onPendingChange={onPendingChange}
                onChanged={onChanged}
            />
        </div>
    );
}
