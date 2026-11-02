"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { createCapture } from "@/lib/catalytic/workerCaptures";
import { CatalyticApiError } from "@/lib/catalytic/api";
import { Button } from "@/components/ui/button";
import VehicleDetailsFields, { vehicleCanContinue } from "@/components/catalytic/VehicleDetailsFields";

export default function NewCapturePage() {
    const router = useRouter();
    const [vehicle, setVehicle] = useState({ vin: "", year: "", make: "", model: "", engine: "" });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const canSubmit = vehicleCanContinue(vehicle);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!canSubmit) return;
        setIsSubmitting(true);
        try {
            const capture = await createCapture({
                vin: vehicle.vin.trim() ? vehicle.vin.trim().toUpperCase() : null,
                year: vehicle.year ? Number(vehicle.year) : null,
                make: vehicle.make.trim() || null,
                model: vehicle.model.trim() || null,
                engine: vehicle.engine.trim() || null,
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
            <button type="button" onClick={() => router.push("/worker")} className="inline-flex min-h-11 items-center gap-1.5 text-xs text-white/50 hover:text-white">
                <ArrowLeft className="h-3.5 w-3.5" /> Cancel
            </button>

            <div>
                <div className="text-[11px] uppercase tracking-wider text-white/40 font-bold">Step 1 of 4</div>
                <h1 className="text-xl font-black text-white/90 mt-1">Add Vehicle</h1>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <VehicleDetailsFields value={vehicle} onChange={setVehicle} autofill />

                <Button type="submit" className="w-full h-14 rounded-2xl text-base" isLoading={isSubmitting} disabled={isSubmitting || !canSubmit}>
                    Continue to Catalysts <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
                {!canSubmit && <p className="text-[11px] text-white/30 text-center">Enter a valid VIN, or year + make + model.</p>}
            </form>
        </div>
    );
}
