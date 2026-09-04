"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { Loader2, ClipboardList, RefreshCw, Search, Car, RotateCcw } from "lucide-react";

import { lookupVehicle, createObservation, listObservations, CatalyticApiError } from "@/lib/catalytic/api";
import { normalizeLookupResult } from "@/lib/catalytic/normalize";
import { getLastLookup, setLastLookup } from "@/lib/catalytic/session";
import VehicleLookupForm from "@/components/catalytic/VehicleLookupForm";
import ObservationQuickForm from "@/components/catalytic/ObservationQuickForm";
import { ConfidenceBadge } from "@/components/catalytic/badges";
import { Button } from "@/components/ui/button";

function fmtDate(s) {
    if (!s) return "—";
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? s : d.toLocaleString();
}

function ObservationsPageInner() {
    const searchParams = useSearchParams();
    const initialPositionCode = searchParams.get("position");
    const initialCode = searchParams.get("code");

    const [query, setQuery] = useState(null);
    const [result, setResult] = useState(null);
    const [isSearching, setIsSearching] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const [recent, setRecent] = useState(null);
    // The backend groups observations under a single physical
    // `vehicle_instance_id`. We keep reusing the same instance for every
    // position recorded on this car during this visit, so "found front +
    // rear on the same Prius" doesn't fragment into two vehicle instances.
    const [vehicleInstanceId, setVehicleInstanceId] = useState(null);

    useEffect(() => {
        const stored = getLastLookup();
        if (stored?.raw) {
            setQuery(stored.query);
            setResult(normalizeLookupResult(stored.raw));
        } else {
            setShowSearch(true);
        }
    }, []);

    const runLookup = useCallback(async (payload) => {
        const raw = await lookupVehicle(payload);
        setResult(normalizeLookupResult(raw));
        setQuery(payload);
        setLastLookup(payload, raw);
        return raw;
    }, []);

    const handleSearch = useCallback(
        async (values, { setSubmitting }) => {
            setIsSearching(true);
            setSubmitting(true);
            try {
                const payload = {
                    year: Number(values.year),
                    make: values.make.trim(),
                    model: values.model.trim(),
                    engine: values.engine ? values.engine.trim() : null,
                    vin: values.vin ? values.vin.trim().toUpperCase() : null,
                };
                await runLookup(payload);
                setVehicleInstanceId(null);
                setShowSearch(false);
                toast.success("Vehicle loaded");
            } catch (e) {
                toast.error(e instanceof CatalyticApiError ? e.message : "Lookup failed");
            } finally {
                setIsSearching(false);
                setSubmitting(false);
            }
        },
        [runLookup]
    );

    const loadRecent = useCallback(async (vehicleKeyId) => {
        try {
            const data = await listObservations(vehicleKeyId ? { vehicle_key_id: vehicleKeyId } : {});
            setRecent(Array.isArray(data) ? data : []);
        } catch {
            setRecent(null);
        }
    }, []);

    useEffect(() => {
        if (result?.vehicleKeyId) loadRecent(result.vehicleKeyId);
    }, [result?.vehicleKeyId, loadRecent]);

    const handleRecord = useCallback(
        async ({ positionCode, physicalCodeRaw, notes, photoUrl }) => {
            if (!result || !query) return;
            setIsSubmitting(true);
            try {
                const payload = vehicleInstanceId
                    ? { vehicle_instance_id: vehicleInstanceId }
                    : {
                          year: query.year,
                          make: query.make,
                          model: query.model,
                          engine: query.engine || null,
                          vin: query.vin || null,
                      };

                const response = await createObservation({
                    ...payload,
                    position_code: positionCode,
                    physical_code_raw: physicalCodeRaw,
                    notes,
                    photo_url: photoUrl,
                });

                if (response?.vehicle_instance_id && !vehicleInstanceId) {
                    setVehicleInstanceId(response.vehicle_instance_id);
                }

                toast.success("Observation recorded");
                await runLookup(query);
                if (result.vehicleKeyId) loadRecent(result.vehicleKeyId);
            } catch (e) {
                toast.error(e instanceof CatalyticApiError ? e.message : "Failed to record observation");
            } finally {
                setIsSubmitting(false);
            }
        },
        [result, query, vehicleInstanceId, runLookup, loadRecent]
    );

    const vehicleSummary = useMemo(() => {
        if (!result) return null;
        return `${result.vehicleLabel || "Vehicle"} • ${result.catalystCount ?? "?"} expected catalyst(s)`;
    }, [result]);

    return (
        <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
            <div className="space-y-5">
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5 sm:p-6">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-white/40 font-bold">
                            <ClipboardList className="h-3.5 w-3.5 text-emerald-400" />
                            Record Actual Observation
                        </div>
                        <Button variant="outline" size="sm" className="rounded-xl border-white/15" onClick={() => setShowSearch((s) => !s)}>
                            <Search className="mr-1.5 h-3.5 w-3.5" />
                            {showSearch ? "Hide search" : "Change vehicle"}
                        </Button>
                    </div>

                    {showSearch && (
                        <div className="mt-4 pt-4 border-t border-white/5">
                            <VehicleLookupForm onSubmit={handleSearch} isSubmitting={isSearching} />
                        </div>
                    )}

                    {result ? (
                        <div className="mt-4 flex items-center justify-between gap-3 flex-wrap rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
                            <div>
                                <div className="text-sm font-bold text-white/90">{result.vehicleLabel || "Selected vehicle"}</div>
                                <div className="text-xs text-white/45">{vehicleSummary}</div>
                                <div className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-white/40">
                                    <Car className="h-3 w-3" />
                                    {vehicleInstanceId ? (
                                        <>
                                            Recording on the same physical car
                                            <button type="button" onClick={() => setVehicleInstanceId(null)} className="ml-1 inline-flex items-center gap-1 text-sky-300 hover:text-sky-200 font-semibold">
                                                <RotateCcw className="h-3 w-3" /> different car?
                                            </button>
                                        </>
                                    ) : (
                                        "First observation for this car will create its record"
                                    )}
                                </div>
                            </div>
                            <ConfidenceBadge confidence={result.confidence} />
                        </div>
                    ) : (
                        <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-6 text-center text-sm text-white/45">
                            No vehicle loaded yet — search above.
                        </div>
                    )}
                </div>

                {result && (
                    <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5 sm:p-6">
                        <ObservationQuickForm
                            positions={result.positions}
                            initialPositionCode={initialPositionCode}
                            initialCode={initialCode}
                            onSubmit={handleRecord}
                            isSubmitting={isSubmitting}
                        />
                    </div>
                )}
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5 sm:p-6 h-fit">
                <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="text-[10px] uppercase tracking-[0.24em] text-white/40 font-bold">Recent Observations</div>
                    <button
                        type="button"
                        onClick={() => result?.vehicleKeyId && loadRecent(result.vehicleKeyId)}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                </div>

                {recent === null ? (
                    <div className="text-xs text-white/35 italic">Could not load observation history.</div>
                ) : recent.length === 0 ? (
                    <div className="text-xs text-white/35 italic">No observations recorded yet for this vehicle.</div>
                ) : (
                    <div className="space-y-2 max-h-[520px] overflow-auto">
                        {recent.map((obs) => (
                            <div key={obs.id} className="rounded-xl border border-white/10 bg-black/25 px-3 py-2.5">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="font-mono text-xs font-bold text-white/85">
                                        {obs.physical_code_raw || "no code read"}
                                    </span>
                                    <span className="text-[10px] text-white/35">{fmtDate(obs.created_at)}</span>
                                </div>
                                {obs.notes && <div className="text-[11px] text-white/35 mt-1 italic truncate">{obs.notes}</div>}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function ObservationsPage() {
    return (
        <Suspense fallback={<div className="flex items-center gap-2 text-white/50 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}>
            <ObservationsPageInner />
        </Suspense>
    );
}
