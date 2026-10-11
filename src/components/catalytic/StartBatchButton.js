"use client";

import React, { useState } from "react";
import toast from "react-hot-toast";
import { PlayCircle, AlertTriangle, X, Loader2 } from "lucide-react";

import { getBatch, startBatch } from "@/lib/catalytic/catdbBatch";
import { CatalyticApiError } from "@/lib/catalytic/api";
import { Button } from "@/components/ui/button";

// Standalone "Start" trigger for a batch that already exists in CREATED
// state (e.g. reached from the Batches list rather than the fresh
// create-review flow in CreateCatdbBatchFlow.js). Always re-fetches the
// batch and shows the same deliberate "may consume CatDB lookups"
// confirmation before calling POST .../start — no one-click start exists
// anywhere in this app.
export default function StartBatchButton({ batchId, size = "sm", onStarted }) {
    const [open, setOpen] = useState(false);
    const [batch, setBatch] = useState(null);
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);

    const openModal = async () => {
        setOpen(true);
        setLoading(true);
        try {
            setBatch(await getBatch(batchId));
        } catch (e) {
            toast.error(e instanceof CatalyticApiError ? e.message : "Failed to load batch");
            setOpen(false);
        } finally {
            setLoading(false);
        }
    };

    const handleStart = async () => {
        setBusy(true);
        try {
            const started = await startBatch(batchId);
            toast.success(`Batch #${started.id} started`);
            setOpen(false);
            onStarted?.(started.id);
        } catch (e) {
            toast.error(e instanceof CatalyticApiError ? e.message : "Failed to start batch");
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <Button size={size} onClick={openModal} className="rounded-xl bg-amber-500 text-black hover:bg-amber-400">
                <PlayCircle className="h-3.5 w-3.5" /> Start
            </Button>

            {open && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => !busy && setOpen(false)}>
                    <div className="max-w-md w-full rounded-2xl border border-white/10 bg-[#0b0d12] p-5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <div className="text-sm font-bold text-white/90 uppercase tracking-wide">Start CatDB Processing?</div>
                            {!busy && <button type="button" onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-white/10 text-white/50"><X className="h-4 w-4" /></button>}
                        </div>
                        {loading ? (
                            <div className="flex items-center gap-2 text-white/50 text-sm py-8 justify-center"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
                        ) : batch ? (
                            <div className="space-y-4">
                                <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.07] p-4 text-sm text-amber-100 flex gap-3">
                                    <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                                    <div className="space-y-1.5">
                                        <div className="font-bold">Start CatDB processing for {batch.items?.length ?? batch.requested_limit} vehicle{(batch.items?.length ?? 0) === 1 ? "" : "s"}?</div>
                                        <p className="text-xs text-amber-200/70">VIN searches may consume CatDB lookup quota. Processing is sequential and pauses automatically if anything looks wrong.</p>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2">
                                    <Button variant="outline" onClick={() => setOpen(false)} disabled={busy} className="rounded-xl">Cancel</Button>
                                    <Button onClick={handleStart} isLoading={busy} className="rounded-xl bg-amber-500 text-black hover:bg-amber-400">Start Processing</Button>
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>
            )}
        </>
    );
}
