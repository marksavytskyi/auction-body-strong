"use client";

import React, { useState } from "react";
import toast from "react-hot-toast";
import { X, Gauge, AlertTriangle, Pencil, Check, Ban } from "lucide-react";

import { setOperationsVehicleWeight, setOperationsVehicleScrapOverride } from "@/lib/operations/api";
import { CatalyticApiError } from "@/lib/catalytic/http";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StatusPill from "@/components/catalytic/StatusPill";
import { LEG_STATUS_TONE, CATS_SOURCE_LABEL } from "@/lib/operations/constants";
import { formatMoney, formatWeight, formatDate, completenessMeta, componentLabel } from "@/lib/operations/format";

function Row({ label, value, tone }) {
    return (
        <div className="flex items-center justify-between gap-3 py-1.5 border-b border-white/5 last:border-b-0">
            <span className="text-[11px] text-white/40 uppercase tracking-wider font-bold">{label}</span>
            <span className={`text-sm font-semibold ${tone || "text-white/85"}`}>{value}</span>
        </div>
    );
}

export default function VehicleDetailModal({ vehicle, onClose, onUpdated }) {
    const [editingWeight, setEditingWeight] = useState(false);
    const [weightInput, setWeightInput] = useState("");
    const [busy, setBusy] = useState(false);

    if (!vehicle) return null;
    const fin = vehicle.financials || {};
    const cm = completenessMeta(fin.completeness_status);

    const warnings = (() => {
        try {
            const parsed = vehicle.warnings_json ? JSON.parse(vehicle.warnings_json) : null;
            if (!parsed) return [];
            return Array.isArray(parsed) ? parsed : [String(parsed)];
        } catch {
            return [];
        }
    })();

    const handleSetWeight = async () => {
        const n = Number(weightInput);
        if (!weightInput || !Number.isFinite(n) || n <= 0) {
            toast.error("Enter a positive curb weight in lb");
            return;
        }
        setBusy(true);
        try {
            const updated = await setOperationsVehicleWeight(vehicle.operations_batch_id, vehicle.id, n);
            toast.success("Manual weight set");
            setEditingWeight(false);
            onUpdated?.(updated);
        } catch (e) {
            toast.error(e instanceof CatalyticApiError ? e.message : "Failed to set manual weight");
        } finally {
            setBusy(false);
        }
    };

    const handleClearWeight = async () => {
        setBusy(true);
        try {
            const updated = await setOperationsVehicleWeight(vehicle.operations_batch_id, vehicle.id, null);
            toast.success("Manual weight cleared");
            onUpdated?.(updated);
        } catch (e) {
            toast.error(e instanceof CatalyticApiError ? e.message : "Failed to clear manual weight");
        } finally {
            setBusy(false);
        }
    };

    const handleClearScrapOverrides = async () => {
        setBusy(true);
        try {
            const updated = await setOperationsVehicleScrapOverride(vehicle.operations_batch_id, vehicle.id, {
                scrapPercentageOverride: null, scrapRateOverride: null,
            });
            toast.success("Scrap overrides cleared — using batch defaults");
            onUpdated?.(updated);
        } catch (e) {
            toast.error(e instanceof CatalyticApiError ? e.message : "Failed to clear scrap overrides");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
            <div
                className="max-w-2xl w-full max-h-[88vh] overflow-auto rounded-2xl border border-white/10 bg-[#0b0d12] p-5 sm:p-6"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <div className="text-sm font-bold text-white/90">
                            {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Unknown vehicle"}
                        </div>
                        <div className="text-[11px] text-white/40 font-mono mt-0.5">{vehicle.full_vin || "—"} · Lot {vehicle.lot_number || "—"}</div>
                    </div>
                    <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {!vehicle.row_valid && (
                    <div className="mb-4 rounded-xl border border-rose-500/25 bg-rose-500/[0.06] p-3 text-xs text-rose-300 flex items-start gap-2">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {vehicle.validation_error || "This row failed validation."}
                    </div>
                )}

                <div className="rounded-xl border border-white/10 bg-black/25 p-4 mb-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] uppercase tracking-wider text-white/40 font-bold">Recovery Estimate</span>
                        <StatusPill label={cm.label} tone={cm.tone} />
                    </div>
                    <div className="text-2xl font-black text-emerald-300 mb-1">
                        {fin.total_expected_recovery != null
                            ? formatMoney(fin.total_expected_recovery)
                            : fin.known_components_subtotal != null
                                ? `${formatMoney(fin.known_components_subtotal)} (partial)`
                                : "—"}
                    </div>
                    <div className="text-[11px] text-white/40">
                        {fin.components_available}/{fin.components_expected} components known
                        {fin.missing_components?.length > 0 && ` — missing ${fin.missing_components.map(componentLabel).join(", ")}`}
                    </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/25 p-4 mb-4">
                    <Row label="Engine" value={formatMoney(fin.engine_value)} />
                    <Row label="Transmission" value={formatMoney(fin.transmission_value)} />
                    <Row
                        label="Catalytic"
                        value={formatMoney(fin.cats_value)}
                        tone={fin.cats_source ? "text-white/85" : undefined}
                    />
                    {fin.cats_source && (
                        <div className="text-[10px] text-white/35 text-right -mt-1 mb-1">{CATS_SOURCE_LABEL[fin.cats_source] || fin.cats_source}</div>
                    )}
                    <Row label="Scrap" value={formatMoney(fin.scrap_value)} />
                    <Row label="Scrap weight" value={formatWeight(fin.scrap_weight_lb)} />
                </div>

                <div className="rounded-xl border border-white/10 bg-black/25 p-4 mb-4">
                    <div className="text-[11px] uppercase tracking-wider text-white/40 font-bold mb-2 inline-flex items-center gap-1.5">
                        <Gauge className="h-3 w-3" /> Curb Weight
                    </div>
                    <Row label="Value" value={formatWeight(vehicle.curb_weight_lb)} />
                    <Row label="Source" value={vehicle.weight_source} />
                    <Row label="Resolved" value={formatDate(vehicle.weight_resolved_at)} />
                    {vehicle.weight_nhtsa_error_code && <Row label="NHTSA error" value={vehicle.weight_nhtsa_error_code} tone="text-rose-300" />}

                    {editingWeight ? (
                        <div className="flex items-center gap-2 mt-3">
                            <Input
                                value={weightInput}
                                onChange={(e) => setWeightInput(e.target.value.replace(/[^0-9.]/g, ""))}
                                placeholder="Curb weight (lb)"
                                className="h-9 rounded-xl bg-white/5 border-white/10 text-xs"
                            />
                            <Button size="sm" className="rounded-xl" onClick={handleSetWeight} isLoading={busy}><Check className="h-3.5 w-3.5" /></Button>
                            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setEditingWeight(false)} disabled={busy}><Ban className="h-3.5 w-3.5" /></Button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 mt-3">
                            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => { setWeightInput(vehicle.curb_weight_lb ? String(vehicle.curb_weight_lb) : ""); setEditingWeight(true); }}>
                                <Pencil className="h-3.5 w-3.5" /> Set Manual Weight
                            </Button>
                            {vehicle.weight_source === "MANUAL" && (
                                <Button size="sm" variant="outline" className="rounded-xl" onClick={handleClearWeight} isLoading={busy}>Clear Override</Button>
                            )}
                        </div>
                    )}
                </div>

                {(vehicle.scrap_percentage_override != null || vehicle.scrap_rate_override != null) && (
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.05] p-4 mb-4">
                        <div className="text-[11px] uppercase tracking-wider text-amber-300/80 font-bold mb-2">Scrap Overrides Active</div>
                        {vehicle.scrap_percentage_override != null && <Row label="Scrap % override" value={`${Number(vehicle.scrap_percentage_override) * 100}%`} />}
                        {vehicle.scrap_rate_override != null && <Row label="Scrap rate override" value={`$${vehicle.scrap_rate_override}/lb`} />}
                        <Button size="sm" variant="outline" className="rounded-xl mt-2" onClick={handleClearScrapOverrides} isLoading={busy}>Clear Overrides (use batch defaults)</Button>
                    </div>
                )}

                <div className="rounded-xl border border-white/10 bg-black/25 p-4 mb-4">
                    <div className="text-[11px] uppercase tracking-wider text-white/40 font-bold mb-2">Processing Status</div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <StatusPill label={`Parts: ${vehicle.parts_status}`} tone={LEG_STATUS_TONE[vehicle.parts_status] || "neutral"} />
                        <StatusPill label={`OurDB: ${vehicle.ourdb_status}`} tone={LEG_STATUS_TONE[vehicle.ourdb_status] || "neutral"} />
                        <StatusPill label={`CatDB: ${vehicle.catdb_status}`} tone={LEG_STATUS_TONE[vehicle.catdb_status] || "neutral"} />
                        <StatusPill label={`Overall: ${vehicle.overall_status}`} tone="neutral" />
                    </div>
                    {vehicle.parts_match_reason && <div className="text-[11px] text-white/35 mt-2">Parts match: {vehicle.parts_match_reason}</div>}
                </div>

                {warnings.length > 0 && (
                    <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-4">
                        <div className="text-[11px] uppercase tracking-wider text-amber-300/80 font-bold mb-2 inline-flex items-center gap-1.5">
                            <AlertTriangle className="h-3 w-3" /> Warnings
                        </div>
                        <ul className="text-xs text-amber-200/80 space-y-1 list-disc list-inside">
                            {warnings.map((w, i) => <li key={i}>{w}</li>)}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
}
