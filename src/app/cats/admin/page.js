"use client";

import React, { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { ShieldAlert, Loader2, Save, Ban, RefreshCw, ArrowLeft, Search } from "lucide-react";

import {
    listVehicleKeys,
    getVehicleKey,
    overrideVehicleKey,
    overridePosition,
    rejectCandidate,
    listOverrideLog,
    CatalyticApiError,
} from "@/lib/catalytic/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const TABS = [
    { id: "vehicle-keys", label: "Vehicle Keys" },
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

export default function CatsAdminPage() {
    const [tab, setTab] = useState("vehicle-keys");

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
                    {tab === "log" && <OverrideLogPanel />}
                </div>
            </div>
        </div>
    );
}
