"use client";

import React, { useState } from "react";
import toast from "react-hot-toast";
import { Layers, X, AlertTriangle, Loader2, PlayCircle } from "lucide-react";

import { createBatch, startBatch, cancelBatch, BATCH_SIZE_PRESETS, KNOWN_MAX_BATCH_SIZE } from "@/lib/catalytic/catdbBatch";
import { CatalyticApiError } from "@/lib/catalytic/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Three deliberate steps — see product spec: creating a batch only
// reserves vehicles (zero CatDB cost); starting it is the one action that
// can spend real CatDB lookups, so it gets its own explicit confirmation
// on top of the review screen. There is no path from "pick" straight to a
// started batch without passing through "review".
const STEP = { PICK: "pick", REVIEW: "review", CONFIRM_START: "confirm_start" };

function Overlay({ children, onClose }) {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
            <div
                className="max-w-lg w-full max-h-[85vh] overflow-auto rounded-2xl border border-white/10 bg-[#0b0d12] p-5 sm:p-6"
                onClick={(e) => e.stopPropagation()}
            >
                {children}
            </div>
        </div>
    );
}

export default function CreateCatdbBatchFlow({ copartImportId, readyCount, onStarted }) {
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState(STEP.PICK);
    const [limit, setLimit] = useState(3);
    const [customLimit, setCustomLimit] = useState("");
    const [busy, setBusy] = useState(false);
    const [batch, setBatch] = useState(null);

    const reset = () => {
        setOpen(false);
        setStep(STEP.PICK);
        setLimit(3);
        setCustomLimit("");
        setBatch(null);
    };

    const effectiveLimit = customLimit ? Number(customLimit) : limit;

    const handleCreate = async () => {
        const n = Number(effectiveLimit);
        if (!Number.isInteger(n) || n < 1) {
            toast.error("Choose how many vehicles to include");
            return;
        }
        if (n > KNOWN_MAX_BATCH_SIZE) {
            toast.error(`Backend caps batches at ${KNOWN_MAX_BATCH_SIZE} vehicles`);
            return;
        }
        setBusy(true);
        try {
            const created = await createBatch({ copartImportId, limit: n });
            setBatch(created);
            setStep(STEP.REVIEW);
        } catch (e) {
            toast.error(e instanceof CatalyticApiError ? e.message : "Failed to create batch");
        } finally {
            setBusy(false);
        }
    };

    // Review's "Cancel" really cancels the just-created reservation on the
    // backend — the batch already exists (and its vehicles are reserved)
    // the moment createBatch succeeds, so a bare client-side close would
    // leave those vehicles un-releasable until someone cancels it later.
    const handleCancelReservation = async () => {
        if (!batch) { reset(); return; }
        setBusy(true);
        try {
            await cancelBatch(batch.id);
            toast("Reservation cancelled — vehicles released", { icon: "↩️" });
        } catch (e) {
            toast.error(e instanceof CatalyticApiError ? e.message : "Failed to cancel reservation");
        } finally {
            setBusy(false);
            reset();
        }
    };

    const handleStart = async () => {
        if (!batch) return;
        setBusy(true);
        try {
            const started = await startBatch(batch.id);
            toast.success(`Batch #${started.id} started`);
            reset();
            onStarted?.(started.id);
        } catch (e) {
            toast.error(e instanceof CatalyticApiError ? e.message : "Failed to start batch");
            setBusy(false);
        }
    };

    if (!open) {
        return (
            <Button onClick={() => setOpen(true)} disabled={!readyCount} className="rounded-xl">
                <Layers className="h-4 w-4" /> Create CatDB Batch
            </Button>
        );
    }

    return (
        <Overlay onClose={busy ? undefined : (step === STEP.REVIEW ? undefined : reset)}>
            <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-bold text-white/90 uppercase tracking-wide inline-flex items-center gap-2">
                    <Layers className="h-4 w-4 text-sky-400" />
                    {step === STEP.PICK && "Create CatDB Batch"}
                    {step === STEP.REVIEW && `${batch?.items?.length ?? 0} Vehicles Selected`}
                    {step === STEP.CONFIRM_START && "Start CatDB Processing?"}
                </div>
                {!busy && step !== STEP.REVIEW && (
                    <button type="button" onClick={reset} className="p-1 rounded-lg hover:bg-white/10 text-white/50">
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>

            {step === STEP.PICK && (
                <div className="space-y-4">
                    <p className="text-xs text-white/45">
                        {readyCount} vehicles are ready for CatDB in this import. Choose how many to include in this batch —
                        there is no option to select all; a deliberate count keeps CatDB usage controlled.
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                        {BATCH_SIZE_PRESETS.filter((n) => n <= Math.max(readyCount, 1)).map((n) => (
                            <button
                                key={n}
                                type="button"
                                onClick={() => { setLimit(n); setCustomLimit(""); }}
                                className={[
                                    "h-10 w-14 rounded-xl text-sm font-bold border transition-all",
                                    !customLimit && limit === n
                                        ? "bg-sky-500/15 border-sky-500/40 text-sky-300"
                                        : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10",
                                ].join(" ")}
                            >
                                {n}
                            </button>
                        ))}
                        <Input
                            value={customLimit}
                            onChange={(e) => setCustomLimit(e.target.value.replace(/[^0-9]/g, ""))}
                            placeholder="Custom"
                            className="h-10 w-24 rounded-xl bg-white/5 border-white/10 text-sm"
                        />
                    </div>
                    <p className="text-[11px] text-white/30">Backend maximum per batch: {KNOWN_MAX_BATCH_SIZE}.</p>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={reset} className="rounded-xl">Cancel</Button>
                        <Button onClick={handleCreate} isLoading={busy} className="rounded-xl">Reserve Vehicles</Button>
                    </div>
                </div>
            )}

            {step === STEP.REVIEW && batch && (
                <div className="space-y-4">
                    <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.05] p-3 text-xs text-sky-200/80">
                        Reserved only — no CatDB search has happened yet. Review the list below, then start processing when ready.
                    </div>
                    <div className="space-y-1.5 max-h-[40vh] overflow-auto pr-1">
                        {batch.items.map((item) => (
                            <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/25 px-3 py-2">
                                <div className="min-w-0">
                                    <div className="text-sm font-bold text-white/85 truncate">
                                        {[item.year, item.make, item.model].filter(Boolean).join(" ") || "Unknown vehicle"}
                                    </div>
                                    <div className="text-[11px] text-white/40 font-mono">{item.vin || "—"}</div>
                                </div>
                                <div className="text-[11px] text-white/40 shrink-0">Lot {item.lot_number || "—"}</div>
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                        <Button variant="outline" onClick={handleCancelReservation} isLoading={busy} className="rounded-xl">
                            Cancel Reservation
                        </Button>
                        <Button onClick={() => setStep(STEP.CONFIRM_START)} className="rounded-xl bg-amber-500 text-black hover:bg-amber-400">
                            <PlayCircle className="h-4 w-4" /> Start Batch
                        </Button>
                    </div>
                </div>
            )}

            {step === STEP.CONFIRM_START && batch && (
                <div className="space-y-4">
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.07] p-4 text-sm text-amber-100 flex gap-3">
                        <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                        <div className="space-y-1.5">
                            <div className="font-bold">Start CatDB processing for {batch.items.length} vehicle{batch.items.length === 1 ? "" : "s"}?</div>
                            <p className="text-xs text-amber-200/70">
                                This will search CatDB one VIN at a time and may consume paid CatDB lookup quota. Processing
                                pauses automatically before the next VIN if anything looks wrong — it will not run away unattended.
                            </p>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setStep(STEP.REVIEW)} disabled={busy} className="rounded-xl">
                            Back
                        </Button>
                        <Button onClick={handleStart} isLoading={busy} className="rounded-xl bg-amber-500 text-black hover:bg-amber-400">
                            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />} Start Processing
                        </Button>
                    </div>
                </div>
            )}
        </Overlay>
    );
}
