"use client";

import React, { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Search } from "lucide-react";

import { lookupVehicle, CatalyticApiError } from "@/lib/catalytic/api";
import { normalizeLookupResult } from "@/lib/catalytic/normalize";
import { setLastLookup } from "@/lib/catalytic/session";
import VehicleLookupForm from "@/components/catalytic/VehicleLookupForm";
import LookupResult from "@/components/catalytic/LookupResult";

export default function CatsLookupPage() {
    const router = useRouter();
    const [result, setResult] = useState(null);
    const [error, setError] = useState("");

    const handleSubmit = useCallback(async (values, { setSubmitting }) => {
        setError("");
        setSubmitting(true);
        try {
            const payload = {
                year: Number(values.year),
                make: values.make.trim(),
                model: values.model.trim(),
                engine: values.engine ? values.engine.trim() : null,
                vin: values.vin ? values.vin.trim().toUpperCase() : null,
            };
            const raw = await lookupVehicle(payload);
            setResult(normalizeLookupResult(raw));
            setLastLookup(payload, raw);
            toast.success("Lookup complete");
        } catch (e) {
            const msg = e instanceof CatalyticApiError ? e.message : "Lookup failed";
            setError(msg);
            toast.error(msg);
            setResult(null);
        } finally {
            setSubmitting(false);
        }
    }, []);

    const handleRecordObservation = useCallback(
        (position, candidate) => {
            const params = new URLSearchParams();
            if (position?.code) params.set("position", String(position.code));
            if (candidate?.code) params.set("code", String(candidate.code));
            router.push(`/cats/observations?${params.toString()}`);
        },
        [router]
    );

    return (
        <div className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5 sm:p-6">
                <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-white/40 font-bold mb-4">
                    <Search className="h-3.5 w-3.5 text-sky-400" />
                    Vehicle Lookup
                </div>
                <VehicleLookupForm onSubmit={handleSubmit} />
                {error && (
                    <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium">
                        {error}
                    </div>
                )}
            </div>

            {result ? (
                <LookupResult result={result} onRecordObservation={handleRecordObservation} />
            ) : (
                !error && (
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-8 text-sm text-white/45 text-center">
                        Enter a vehicle above to see expected catalytic converters, candidate codes, and pricing.
                    </div>
                )
            )}
        </div>
    );
}
