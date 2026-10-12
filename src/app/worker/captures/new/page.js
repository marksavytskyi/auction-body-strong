"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ArrowLeft, Hash, ArrowRight } from "lucide-react";

import { createCapture } from "@/lib/catalytic/workerCaptures";
import { CatalyticApiError } from "@/lib/catalytic/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function NewCapturePage() {
    const router = useRouter();
    const [vin, setVin] = useState("");
    const [year, setYear] = useState("");
    const [make, setMake] = useState("");
    const [model, setModel] = useState("");
    const [engine, setEngine] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const canSubmit = vin.trim().length === 17 || (year && make.trim() && model.trim());

    // Auto-uppercase as the worker types — trimmed again on submit. VINs are
    // never lowercase in practice; doing this live (not just on submit)
    // avoids a worker having to re-check casing before moving on.
    const handleVinChange = (e) => setVin(e.target.value.toUpperCase());

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!canSubmit) return;
        setIsSubmitting(true);
        try {
            const capture = await createCapture({
                vin: vin.trim() ? vin.trim().toUpperCase() : null,
                year: year ? Number(year) : null,
                make: make.trim() || null,
                model: model.trim() || null,
                engine: engine.trim() || null,
            });
            router.push(`/worker/captures/${capture.id}`);
        } catch (e2) {
            toast.error(e2 instanceof CatalyticApiError ? e2.message : "Failed to start capture");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-5">
            <button type="button" onClick={() => router.push("/worker")} className="inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white">
                <ArrowLeft className="h-3.5 w-3.5" /> Cancel
            </button>

            <div>
                <div className="text-[11px] uppercase tracking-wider text-white/40 font-bold">Step 1 of 4</div>
                <h1 className="text-xl font-black text-white/90 mt-1">Add Vehicle</h1>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4 space-y-2">
                    <Label className="text-white/70 text-xs uppercase tracking-wider inline-flex items-center gap-1.5">
                        <Hash className="h-3.5 w-3.5" /> VIN (easiest — 17 characters)
                    </Label>
                    <Input
                        value={vin}
                        onChange={handleVinChange}
                        maxLength={17}
                        placeholder="Scan or type VIN"
                        className="h-14 rounded-xl bg-white/5 border-white/10 font-mono uppercase text-base"
                        autoFocus
                    />
                    {vin.length > 0 && vin.length !== 17 && (
                        <p className="text-[11px] text-white/35">{vin.length}/17 characters</p>
                    )}
                </div>

                <div className="text-center text-[11px] text-white/30 uppercase tracking-wider">— or enter manually —</div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <Label className="text-white/60 text-xs uppercase tracking-wider">Year</Label>
                        <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder="2018" className="h-12 rounded-xl bg-white/5 border-white/10" />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-white/60 text-xs uppercase tracking-wider">Make</Label>
                        <Input value={make} onChange={(e) => setMake(e.target.value)} placeholder="Ford" className="h-12 rounded-xl bg-white/5 border-white/10" />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-white/60 text-xs uppercase tracking-wider">Model</Label>
                        <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="F-150" className="h-12 rounded-xl bg-white/5 border-white/10" />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-white/60 text-xs uppercase tracking-wider">Engine</Label>
                        <Input value={engine} onChange={(e) => setEngine(e.target.value)} placeholder="3.5L" className="h-12 rounded-xl bg-white/5 border-white/10" />
                    </div>
                </div>

                <Button type="submit" className="w-full h-14 rounded-2xl text-base" isLoading={isSubmitting} disabled={isSubmitting || !canSubmit}>
                    Continue to Catalysts <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
                {!canSubmit && <p className="text-[11px] text-white/30 text-center">Enter a VIN, or year + make + model.</p>}
            </form>
        </div>
    );
}
