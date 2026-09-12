"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { ShieldAlert, Loader2, Save, Ban, RefreshCw, ArrowLeft, Search, ClipboardList, Car, RotateCcw } from "lucide-react";

import {
    listVehicleKeys,
    getVehicleKey,
    overrideVehicleKey,
    overridePosition,
    rejectCandidate,
    listOverrideLog,
    lookupVehicle,
    createObservation,
    listObservations,
    CatalyticApiError,
} from "@/lib/catalytic/api";
import { normalizeLookupResult } from "@/lib/catalytic/normalize";
import { getLastLookup, setLastLookup } from "@/lib/catalytic/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfidenceBadge } from "@/components/catalytic/badges";
import VehicleLookupForm from "@/components/catalytic/VehicleLookupForm";
import ObservationQuickForm from "@/components/catalytic/ObservationQuickForm";

const TABS = [
    { id: "vehicle-keys", label: "Vehicle Keys" },
    { id: "direct-entry", label: "Direct Entry" },
    { id: "log", label: "Override Log" },
];

function fmtDate(s) {
    if (!s) return "—";
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? s : d.toLocaleString();
}

function CandidateRejectButton({ candidate, onRejected }) {
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState("");
    const [busy, setBusy] = useState(false);

    if (candidate.rejected_count > 0 && !open) {
        return <span className="text-[10px] uppercase tracking-wider text-rose-400/70 font-bold">Rejected {candidate.rejected_count}x</span>;
    }

    if (!open) {
        return (
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-500/25 bg-rose-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-rose-300 hover:bg-rose-500/20 transition-colors"
            >
                <Ban className="h-3 w-3" /> Reject
            </button>
        );
    }

    return (
        <div className="flex items-center gap-1.5">
            <Input
                autoFocus
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason (required)"
                className="h-7 w-40 rounded-lg bg-white/5 border-white/10 text-[11px]"
            />
            <Button
                size="sm"
                variant="destructive"
                className="h-7 rounded-lg px-2 text-[10px]"
                disabled={!reason.trim() || busy}
                onClick={async () => {
                    setBusy(true);
                    try {
                        await rejectCandidate(candidate.id, reason.trim());
                        toast.success(`Candidate ${candidate.code} rejected`);
                        setOpen(false);
                        onRejected();
                    } catch (e) {
                        toast.error(e instanceof CatalyticApiError ? e.message : "Reject failed");
                    } finally {
                        setBusy(false);
                    }
                }}
            >
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirm"}
            </Button>
            <button type="button" onClick={() => setOpen(false)} className="text-[10px] text-white/40 hover:text-white/70">
                cancel
            </button>
        </div>
    );
}

function InlineOverride({ label, field, currentValue, onSave, numeric = false }) {
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(currentValue ?? "");
    const [reason, setReason] = useState("");
    const [busy, setBusy] = useState(false);

    if (!editing) {
        return (
            <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-white/45">{label}</span>
                <button type="button" onClick={() => setEditing(true)} className="text-white/85 hover:text-emerald-300 transition-colors font-semibold">
                    {currentValue ?? "—"}
                </button>
            </div>
        );
    }

    return (
        <div className="rounded-lg border border-white/10 bg-black/25 p-2 space-y-1.5">
            <div className="text-[11px] text-white/50">{label}</div>
            <Input
                autoFocus
                type={numeric ? "number" : "text"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="h-8 rounded-lg bg-white/5 border-white/10 text-xs"
            />
            <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason (required)"
                className="h-8 rounded-lg bg-white/5 border-white/10 text-xs"
            />
            <div className="flex gap-1.5">
                <Button
                    size="sm"
                    className="h-7 rounded-lg text-[10px] flex-1"
                    disabled={!reason.trim() || value === "" || busy}
                    onClick={async () => {
                        setBusy(true);
                        try {
                            await onSave({ field, value: numeric ? Number(value) : value, reason: reason.trim() });
                            setEditing(false);
                        } finally {
                            setBusy(false);
                        }
                    }}
                >
                    {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
                    Save
                </Button>
                <Button size="sm" variant="outline" className="h-7 rounded-lg border-white/15 text-[10px]" onClick={() => setEditing(false)}>
                    Cancel
                </Button>
            </div>
        </div>
    );
}

function VehicleKeyDetailPanel({ id, onBack }) {
    const [detail, setDetail] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        setIsLoading(true);
        setError("");
        try {
            const data = await getVehicleKey(id);
            setDetail(data);
        } catch (e) {
            setError(e instanceof CatalyticApiError ? e.message : "Failed to load vehicle key");
        } finally {
            setIsLoading(false);
        }
    }, [id]);

    useEffect(() => {
        load();
    }, [load]);

    return (
        <div className="space-y-4">
            <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white transition-colors">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to vehicle keys
            </button>

            {isLoading ? (
                <div className="flex items-center gap-2 text-white/50 text-sm py-8 justify-center"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
            ) : error ? (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium">{error}</div>
            ) : detail ? (
                <>
                    <div className="rounded-2xl border border-white/10 bg-black/25 p-4 space-y-2">
                        <div className="font-bold text-white/90">{detail.make} {detail.model} {detail.year_from ?? ""}{detail.year_to && detail.year_to !== detail.year_from ? `–${detail.year_to}` : ""} {detail.engine}</div>
                        <div className="text-xs text-white/40">{detail.normalized_key} · status: {detail.status} · verified vehicles: {detail.verified_vehicle_count}</div>
                        <div className="max-w-xs pt-1">
                            <InlineOverride
                                label="Expected catalyst count"
                                field="expected_catalyst_count"
                                currentValue={detail.expected_catalyst_count}
                                numeric
                                onSave={async ({ field, value, reason }) => {
                                    try {
                                        await overrideVehicleKey(id, { field, value, reason });
                                        toast.success("Vehicle key updated");
                                        load();
                                    } catch (e) {
                                        toast.error(e instanceof CatalyticApiError ? e.message : "Update failed");
                                    }
                                }}
                            />
                        </div>
                    </div>

                    {detail.positions.length === 0 ? (
                        <div className="rounded-2xl border border-white/10 bg-black/25 p-6 text-center text-sm text-white/45">
                            No persisted positions for this vehicle key yet.
                        </div>
                    ) : (
                        detail.positions.map((pos) => (
                            <div key={pos.id} className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
                                <div className="px-4 py-3 border-b border-white/5 bg-white/[0.03] flex items-center justify-between gap-3 flex-wrap">
                                    <div>
                                        <div className="font-bold text-sm text-white/90">{pos.position_code}</div>
                                        <div className="text-[11px] text-white/40">qty {pos.quantity} · confidence {Math.round((pos.confidence || 0) * 100)}%</div>
                                    </div>
                                    <div className="w-40">
                                        <InlineOverride
                                            label="Quantity"
                                            field="quantity"
                                            currentValue={pos.quantity}
                                            numeric
                                            onSave={async ({ field, value, reason }) => {
                                                try {
                                                    await overridePosition(pos.id, { field, value, reason });
                                                    toast.success("Position updated");
                                                    load();
                                                } catch (e) {
                                                    toast.error(e instanceof CatalyticApiError ? e.message : "Update failed");
                                                }
                                            }}
                                        />
                                    </div>
                                </div>
                                <div className="p-3 space-y-2">
                                    {pos.candidates.length === 0 ? (
                                        <div className="text-xs text-white/35 italic px-1">No candidates.</div>
                                    ) : (
                                        pos.candidates.map((c) => (
                                            <div key={c.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/25 px-3 py-2">
                                                <div>
                                                    <span className="font-mono text-sm font-bold text-white/85">{c.code}</span>
                                                    <span className="ml-2 text-[11px] text-white/40">{Math.round((c.probability || 0) * 100)}% · {c.source} · observed {c.observed_count}x</span>
                                                </div>
                                                <CandidateRejectButton candidate={c} onRejected={load} />
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </>
            ) : null}
        </div>
    );
}

function VehicleKeysPanel() {
    const [make, setMake] = useState("");
    const [model, setModel] = useState("");
    const [rows, setRows] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");
    const [selectedId, setSelectedId] = useState(null);

    const load = useCallback(async () => {
        setIsLoading(true);
        setError("");
        try {
            const params = { limit: 50 };
            if (make.trim()) params.make = make.trim();
            if (model.trim()) params.model = model.trim();
            const data = await listVehicleKeys(params);
            setRows(Array.isArray(data) ? data : []);
        } catch (e) {
            setError(e instanceof CatalyticApiError ? e.message : "Failed to load vehicle keys");
            setRows(null);
        } finally {
            setIsLoading(false);
        }
    }, [make, model]);

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (selectedId) {
        return <VehicleKeyDetailPanel id={selectedId} onBack={() => setSelectedId(null)} />;
    }

    return (
        <div className="space-y-4">
            <form
                onSubmit={(e) => { e.preventDefault(); load(); }}
                className="flex flex-col sm:flex-row gap-2"
            >
                <Input value={make} onChange={(e) => setMake(e.target.value)} placeholder="Make" className="h-10 rounded-xl bg-white/5 border-white/10" />
                <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Model" className="h-10 rounded-xl bg-white/5 border-white/10" />
                <Button type="submit" size="sm" className="h-10 rounded-xl px-4" isLoading={isLoading}>
                    <Search className="h-3.5 w-3.5 mr-1.5" /> Search
                </Button>
            </form>

            {isLoading ? (
                <div className="flex items-center gap-2 text-white/50 text-sm py-8 justify-center"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
            ) : error ? (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium">{error}</div>
            ) : !rows || rows.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/25 p-8 text-center text-sm text-white/45">No vehicle keys found.</div>
            ) : (
                <div className="overflow-auto rounded-2xl border border-white/10 bg-black/25">
                    <table className="w-full text-sm">
                        <thead className="bg-black/40 sticky top-0">
                            <tr>
                                {["Vehicle", "Status", "Verified", "Expected Count", ""].map((h) => (
                                    <th key={h} className="px-3 py-2 text-left text-[11px] uppercase tracking-wider text-white/50 font-bold border-b border-white/10 whitespace-nowrap">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => (
                                <tr key={r.id} className="odd:bg-white/[0.02] cursor-pointer hover:bg-white/[0.05]" onClick={() => setSelectedId(r.id)}>
                                    <td className="px-3 py-2 border-b border-white/5 text-white/85 whitespace-nowrap">
                                        {r.make} {r.model} {r.year_from ?? ""}{r.year_to && r.year_to !== r.year_from ? `–${r.year_to}` : ""} {r.engine}
                                    </td>
                                    <td className="px-3 py-2 border-b border-white/5 text-white/60 whitespace-nowrap">{r.status}</td>
                                    <td className="px-3 py-2 border-b border-white/5 text-white/60 whitespace-nowrap">{r.verified_vehicle_count}</td>
                                    <td className="px-3 py-2 border-b border-white/5 text-white/60 whitespace-nowrap">{r.expected_catalyst_count ?? "—"}</td>
                                    <td className="px-3 py-2 border-b border-white/5 text-emerald-300 text-xs font-bold whitespace-nowrap">Edit →</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

// Bypasses the worker capture/moderation pipeline entirely — writes
// straight to /catalytic/observations. Elevated-role tool only (the
// endpoint itself 403s for WORKER, verified live).
function DirectEntryPanel({ initialPositionCode, initialCode }) {
    const [query, setQuery] = useState(null);
    const [result, setResult] = useState(null);
    const [isSearching, setIsSearching] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const [recent, setRecent] = useState(null);
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
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
            <div className="space-y-5">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-white/40 font-bold">
                            <ClipboardList className="h-3.5 w-3.5 text-emerald-400" />
                            Direct Entry (bypasses moderation)
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
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-5">
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

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-5 h-fit">
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

function OverrideLogPanel() {
    const [rows, setRows] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        setIsLoading(true);
        setError("");
        try {
            const data = await listOverrideLog({ limit: 100 });
            setRows(Array.isArray(data) ? data : []);
        } catch (e) {
            setError(e instanceof CatalyticApiError ? e.message : "Failed to load override log");
            setRows(null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    return (
        <div>
            <div className="flex justify-end mb-3">
                <button type="button" onClick={load} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors" title="Refresh">
                    <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
                </button>
            </div>
            {isLoading ? (
                <div className="flex items-center gap-2 text-white/50 text-sm py-8 justify-center"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
            ) : error ? (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium">{error}</div>
            ) : !rows || rows.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/25 p-8 text-center text-sm text-white/45">No overrides recorded yet.</div>
            ) : (
                <div className="overflow-auto rounded-2xl border border-white/10 bg-black/25 max-h-[60vh]">
                    <table className="w-full text-xs">
                        <thead className="bg-black/40 sticky top-0">
                            <tr>
                                {["Entity", "Field", "Old → New", "Reason", "By", "When"].map((h) => (
                                    <th key={h} className="px-3 py-2 text-left uppercase tracking-wider text-white/50 font-bold border-b border-white/10 whitespace-nowrap">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => (
                                <tr key={r.id} className="odd:bg-white/[0.02]">
                                    <td className="px-3 py-2 border-b border-white/5 text-white/75 whitespace-nowrap">{r.entity_type} #{r.entity_id}</td>
                                    <td className="px-3 py-2 border-b border-white/5 text-white/75 whitespace-nowrap">{r.field}</td>
                                    <td className="px-3 py-2 border-b border-white/5 text-white/70 whitespace-nowrap">{r.old_value} → <b className="text-white/90">{r.new_value}</b></td>
                                    <td className="px-3 py-2 border-b border-white/5 text-white/60 max-w-[220px] truncate" title={r.reason}>{r.reason}</td>
                                    <td className="px-3 py-2 border-b border-white/5 text-white/50 whitespace-nowrap">{r.changed_by}</td>
                                    <td className="px-3 py-2 border-b border-white/5 text-white/40 whitespace-nowrap">{fmtDate(r.changed_at)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function CatsAdminPageInner() {
    const searchParams = useSearchParams();
    const [tab, setTab] = useState(searchParams.get("tab") || "vehicle-keys");

    return (
        <div className="space-y-5">
            <div className="rounded-3xl border border-amber-500/20 bg-amber-500/[0.04] backdrop-blur-xl p-4 flex items-center gap-3">
                <ShieldAlert className="h-5 w-5 text-amber-400 shrink-0" />
                <p className="text-xs text-amber-200/80">Administrative corrections. Changes here affect confidence and pricing for everyone and are logged to the override log.</p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl overflow-hidden">
                <div className="flex flex-wrap gap-1 p-2 border-b border-white/[0.06]">
                    {TABS.map((t) => (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => setTab(t.id)}
                            className={`px-3.5 h-9 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                                tab === t.id ? "bg-amber-500/15 border border-amber-500/30 text-amber-300" : "border border-transparent text-white/50 hover:text-white hover:bg-white/5"
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                <div className="p-5 sm:p-6">
                    {tab === "vehicle-keys" && <VehicleKeysPanel />}
                    {tab === "direct-entry" && (
                        <DirectEntryPanel initialPositionCode={searchParams.get("position")} initialCode={searchParams.get("code")} />
                    )}
                    {tab === "log" && <OverrideLogPanel />}
                </div>
            </div>
        </div>
    );
}

export default function CatsAdminPage() {
    return (
        <Suspense fallback={<div className="flex items-center gap-2 text-white/50 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}>
            <CatsAdminPageInner />
        </Suspense>
    );
}
