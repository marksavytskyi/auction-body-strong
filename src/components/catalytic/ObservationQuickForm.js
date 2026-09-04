"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ClipboardPlus, Layers, PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const selectClass =
    "w-full h-11 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all";

// The real ObservationRequest only accepts free-text `physical_code_raw` —
// there is no candidate_id to select. Known candidates are offered as
// quick-fill chips (real data) but the field submitted is always the text.
export default function ObservationQuickForm({ positions, initialPositionCode, initialCode, onSubmit, isSubmitting }) {
    const [positionCode, setPositionCode] = useState(initialPositionCode || "");
    const [code, setCode] = useState(initialCode || "");
    const [notes, setNotes] = useState("");
    const [photoUrl, setPhotoUrl] = useState("");

    useEffect(() => {
        if (initialPositionCode) setPositionCode(initialPositionCode);
    }, [initialPositionCode]);

    useEffect(() => {
        if (initialCode) setCode(initialCode);
    }, [initialCode]);

    const selectedPosition = useMemo(
        () => positions.find((p) => String(p.code) === String(positionCode)) || null,
        [positions, positionCode]
    );

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!positionCode) return;
        onSubmit({
            positionCode,
            physicalCodeRaw: code.trim(),
            notes: notes.trim(),
            photoUrl: photoUrl.trim(),
        });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
                <Label className="text-white/60 text-xs uppercase tracking-wider inline-flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5" /> Catalyst Position
                </Label>
                <select className={selectClass} value={positionCode} onChange={(e) => setPositionCode(e.target.value)}>
                    <option value="" className="bg-[#0c0e13]">Select position…</option>
                    {positions.map((p) => (
                        <option key={p.code} value={p.code} className="bg-[#0c0e13]">
                            {p.name}
                        </option>
                    ))}
                </select>
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="obs_code" className="text-white/60 text-xs uppercase tracking-wider inline-flex items-center gap-1.5">
                    <PencilLine className="h-3.5 w-3.5" /> Physical Code Found
                </Label>
                <Input
                    id="obs_code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Code stamped on the unit (leave blank if unreadable)"
                    className="h-11 rounded-xl bg-white/5 border-white/10 font-mono uppercase"
                />
                {selectedPosition && selectedPosition.candidates.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                        <span className="text-[10px] text-white/35 self-center mr-1">Known candidates:</span>
                        {selectedPosition.candidates.slice(0, 8).map((c, idx) => (
                            <button
                                key={c.id ?? c.code ?? idx}
                                type="button"
                                onClick={() => setCode(c.code)}
                                className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border border-white/10 bg-white/5 text-white/60 hover:border-emerald-500/40 hover:text-emerald-300 transition-colors"
                            >
                                {c.code}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="note" className="text-white/60 text-xs uppercase tracking-wider">Note (optional)</Label>
                <textarea
                    id="note"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    placeholder="Condition, location, anything unusual…"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/50 transition-all resize-none"
                />
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="photo_url" className="text-white/60 text-xs uppercase tracking-wider">Photo reference URL (optional)</Label>
                <Input
                    id="photo_url"
                    value={photoUrl}
                    onChange={(e) => setPhotoUrl(e.target.value)}
                    placeholder="https://…"
                    className="h-11 rounded-xl bg-white/5 border-white/10"
                />
            </div>

            <Button type="submit" className="w-full h-12 rounded-2xl" isLoading={isSubmitting} disabled={isSubmitting || !positionCode}>
                <ClipboardPlus className="mr-1.5 h-4 w-4" />
                Record Observation
            </Button>
        </form>
    );
}
