"use client";

// Operations -> "Settings -> CatDB Devices & Subscriptions" — Phase K.11.
//
// OWNER/ADMIN only — enforced by the existing Operations layout
// (src/app/operations/layout.js) at the route level, and independently
// by every API call below (the backend 403s on its own for anyone who
// reaches this page some other way). Nothing here ever decides
// authorization itself.
//
// Reuses the existing CatDB device/subscription data model exactly —
// see app.operations.catdb_subscriptions' own module docstring. This
// page is purely a thin CRUD surface over that backend; no quota math
// is ever computed client-side.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { ArrowLeft, Loader2, Plus, RefreshCw, Settings2, Smartphone, History, X } from "lucide-react";

import {
    listOperationsCatdbSubscriptions,
    createOperationsCatdbSubscription,
    updateOperationsCatdbSubscription,
    listOperationsCatdbBalanceAdjustments,
    adjustOperationsCatdbSearchBalance,
    listOperationsCatdbSubscriptionRenewals,
    confirmOperationsCatdbSubscriptionRenewal,
    listOperationsCatdbDevices,
    updateOperationsCatdbDevice,
} from "@/lib/operations/api";
import { CatalyticApiError } from "@/lib/catalytic/http";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import StatusPill from "@/components/catalytic/StatusPill";

function fmtDate(s) {
    if (!s) return "—";
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? s : d.toLocaleString();
}

function fmtCount(n) {
    return n === null || n === undefined ? "—" : n;
}

function apiErrorMessage(e, fallback) {
    return e instanceof CatalyticApiError ? e.message : fallback;
}

// ─── create subscription ────────────────────────────────────────────────

function NewSubscriptionForm({ onCreated }) {
    const [open, setOpen] = useState(false);
    const [displayName, setDisplayName] = useState("");
    const [accountEmail, setAccountEmail] = useState("");
    const [resetDay, setResetDay] = useState("1");
    const [monthlyLimit, setMonthlyLimit] = useState("300");
    const [busy, setBusy] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        const parsedResetDay = Number(resetDay);
        const parsedLimit = Number(monthlyLimit);
        if (!displayName.trim() || !accountEmail.trim()) {
            toast.error("Display name and account email are required");
            return;
        }
        if (!Number.isInteger(parsedResetDay) || parsedResetDay < 1 || parsedResetDay > 28) {
            toast.error("Reset day must be an integer between 1 and 28");
            return;
        }
        if (!Number.isInteger(parsedLimit) || parsedLimit <= 0) {
            toast.error("Monthly search limit must be a positive integer");
            return;
        }
        setBusy(true);
        try {
            await createOperationsCatdbSubscription({
                displayName: displayName.trim(), accountEmail: accountEmail.trim(),
                resetDay: parsedResetDay, monthlyLimit: parsedLimit,
            });
            toast.success("CatDB subscription created");
            setDisplayName("");
            setAccountEmail("");
            setResetDay("1");
            setMonthlyLimit("300");
            setOpen(false);
            onCreated();
        } catch (e2) {
            toast.error(apiErrorMessage(e2, "Failed to create subscription"));
        } finally {
            setBusy(false);
        }
    };

    if (!open) {
        return (
            <Button type="button" size="sm" className="h-9 rounded-xl px-3" onClick={() => setOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1.5" /> New subscription
            </Button>
        );
    }

    return (
        <form onSubmit={submit} className="rounded-xl border border-white/10 bg-black/25 p-3 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <div className="space-y-1">
                    <Label className="text-[10px] uppercase text-white/40">Display name</Label>
                    <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Device 1" className="h-9 rounded-lg bg-white/5 border-white/10 text-xs" />
                </div>
                <div className="space-y-1">
                    <Label className="text-[10px] uppercase text-white/40">CatDB account email</Label>
                    <Input value={accountEmail} onChange={(e) => setAccountEmail(e.target.value)} placeholder="account1@gmail.com" className="h-9 rounded-lg bg-white/5 border-white/10 text-xs" />
                </div>
                <div className="space-y-1">
                    <Label className="text-[10px] uppercase text-white/40">Reset day (1-28)</Label>
                    <Input type="number" min={1} max={28} value={resetDay} onChange={(e) => setResetDay(e.target.value)} className="h-9 rounded-lg bg-white/5 border-white/10 text-xs" />
                </div>
                <div className="space-y-1">
                    <Label className="text-[10px] uppercase text-white/40">Monthly search limit</Label>
                    <Input type="number" min={1} value={monthlyLimit} onChange={(e) => setMonthlyLimit(e.target.value)} className="h-9 rounded-lg bg-white/5 border-white/10 text-xs" />
                </div>
            </div>
            <div className="flex items-center gap-2 justify-end">
                <button type="button" onClick={() => setOpen(false)} className="text-xs text-white/40 hover:text-white/70 px-2">Cancel</button>
                <Button type="submit" size="sm" className="h-9 rounded-xl px-4" isLoading={busy}>Create</Button>
            </div>
        </form>
    );
}

// ─── adjust balance dialog (Section 3) ──────────────────────────────────

function AdjustBalanceDialog({ subscription, onClose, onAdjusted }) {
    const [actualRemaining, setActualRemaining] = useState("");
    const [reason, setReason] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const parsed = Number(actualRemaining);
    const valid = actualRemaining !== "" && Number.isInteger(parsed) && parsed >= 0 && reason.trim().length > 0;

    const submit = async () => {
        if (!valid || busy) return;
        setBusy(true);
        setError("");
        try {
            const result = await adjustOperationsCatdbSearchBalance(subscription.id, {
                actualRemaining: parsed, reason: reason.trim(),
            });
            toast.success(`Balance adjusted: ${result.previous_available} -> ${result.new_available}`);
            onAdjusted();
            onClose();
        } catch (e) {
            setError(apiErrorMessage(e, "Failed to adjust search balance"));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
            <div className="max-w-md w-full rounded-2xl border border-white/10 bg-[#0b0d12] p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                    <div className="text-sm font-bold text-white/90">Adjust Search Balance — {subscription.display_name}</div>
                    <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50"><X className="h-4 w-4" /></button>
                </div>
                <p className="text-xs text-white/50">
                    Enter the ACTUAL remaining searches shown on the real CatDB account dashboard. The backend
                    computes and records whatever correction is required against what it already knows — it never
                    overwrites existing search history, and never removes previously-recorded usage.
                </p>
                <div className="space-y-1.5">
                    <Label htmlFor="catdb-adjust-actual-remaining" className="text-[10px] uppercase text-white/40">Actual remaining searches</Label>
                    <Input id="catdb-adjust-actual-remaining" type="number" min={0} value={actualRemaining} onChange={(e) => setActualRemaining(e.target.value)} className="h-10 rounded-xl bg-white/5 border-white/10" />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="catdb-adjust-reason" className="text-[10px] uppercase text-white/40">Reason (required)</Label>
                    <Input id="catdb-adjust-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reconciled against CatDB account dashboard on 2026-10-22" className="h-10 rounded-xl bg-white/5 border-white/10" />
                </div>
                {error && <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">{error}</div>}
                <div className="flex items-center justify-end gap-2">
                    <button type="button" onClick={onClose} className="text-xs text-white/40 hover:text-white/70 px-2">Cancel</button>
                    <Button type="button" onClick={submit} disabled={!valid} isLoading={busy} className="h-9 rounded-xl px-4">Record adjustment</Button>
                </div>
            </div>
        </div>
    );
}

// ─── adjustment history dialog ──────────────────────────────────────────

function AdjustmentHistoryDialog({ subscription, onClose }) {
    const [items, setItems] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        listOperationsCatdbBalanceAdjustments(subscription.id)
            .then((d) => setItems(Array.isArray(d?.items) ? d.items : []))
            .catch((e) => setError(apiErrorMessage(e, "Failed to load adjustment history")));
    }, [subscription.id]);

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
            <div className="max-w-xl w-full rounded-2xl border border-white/10 bg-[#0b0d12] p-5 space-y-3 max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                    <div className="text-sm font-bold text-white/90">Adjustment History — {subscription.display_name}</div>
                    <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50"><X className="h-4 w-4" /></button>
                </div>
                {error ? (
                    <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">{error}</div>
                ) : items === null ? (
                    <div className="flex items-center gap-2 text-white/40 text-sm py-6 justify-center"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
                ) : !items.length ? (
                    <div className="text-xs text-white/35 italic">No adjustments recorded yet.</div>
                ) : (
                    <div className="space-y-2">
                        {items.map((a) => (
                            <div key={a.id} className="rounded-xl border border-white/10 bg-black/25 p-3 text-xs space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="font-bold text-white/85">{a.previous_available} → {a.new_available}</span>
                                    <span className="text-white/40">{fmtDate(a.created_at)}</span>
                                </div>
                                <div className="text-white/60">{a.reason}</div>
                                <div className="text-white/35">Amount recorded: +{a.adjustment_amount} · period {a.period_key} · user #{a.created_by_user_id}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── subscription row (editable) ────────────────────────────────────────

function SubscriptionRow({ subscription, onChanged }) {
    const [editing, setEditing] = useState(false);
    const [displayName, setDisplayName] = useState(subscription.display_name);
    const [accountEmail, setAccountEmail] = useState(subscription.account_email);
    const [resetDay, setResetDay] = useState(String(subscription.reset_day));
    const [monthlyLimit, setMonthlyLimit] = useState(String(subscription.monthly_limit));
    const [busy, setBusy] = useState(false);
    const [showAdjust, setShowAdjust] = useState(false);
    const [showHistory, setShowHistory] = useState(false);

    const saveEdit = async () => {
        setBusy(true);
        try {
            await updateOperationsCatdbSubscription(subscription.id, {
                displayName: displayName.trim(), accountEmail: accountEmail.trim(),
                resetDay: Number(resetDay), monthlyLimit: Number(monthlyLimit),
            });
            toast.success("Subscription updated");
            setEditing(false);
            onChanged();
        } catch (e) {
            toast.error(apiErrorMessage(e, "Failed to update subscription"));
        } finally {
            setBusy(false);
        }
    };

    const toggleEnabled = async () => {
        setBusy(true);
        try {
            await updateOperationsCatdbSubscription(subscription.id, { enabled: !subscription.enabled });
            toast.success(subscription.enabled ? "Subscription disabled" : "Subscription enabled");
            onChanged();
        } catch (e) {
            toast.error(apiErrorMessage(e, "Failed to update subscription"));
        } finally {
            setBusy(false);
        }
    };

    const confirmRenewal = async () => {
        setBusy(true);
        try {
            await confirmOperationsCatdbSubscriptionRenewal(subscription.id);
            toast.success("Subscription renewal confirmed — new period activated");
            onChanged();
        } catch (e) {
            toast.error(apiErrorMessage(e, "Failed to confirm renewal"));
        } finally {
            setBusy(false);
        }
    };

    if (editing) {
        return (
            <div className="rounded-xl border border-white/10 bg-black/25 p-3 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="h-9 rounded-lg bg-white/5 border-white/10 text-xs" />
                    <Input value={accountEmail} onChange={(e) => setAccountEmail(e.target.value)} className="h-9 rounded-lg bg-white/5 border-white/10 text-xs" />
                    <Input type="number" min={1} max={28} value={resetDay} onChange={(e) => setResetDay(e.target.value)} className="h-9 rounded-lg bg-white/5 border-white/10 text-xs" />
                    <Input type="number" min={1} value={monthlyLimit} onChange={(e) => setMonthlyLimit(e.target.value)} className="h-9 rounded-lg bg-white/5 border-white/10 text-xs" />
                </div>
                <div className="flex items-center justify-end gap-2">
                    <button type="button" onClick={() => setEditing(false)} className="text-xs text-white/40 hover:text-white/70 px-2">Cancel</button>
                    <Button type="button" size="sm" onClick={saveEdit} isLoading={busy} className="h-8 rounded-lg px-3">Save</Button>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 flex-wrap">
                <div>
                    <div className="font-bold text-sm text-white/90">{subscription.display_name}</div>
                    <div className="text-[11px] text-white/40">
                        {subscription.account_email} · reset day {subscription.reset_day} · limit {subscription.monthly_limit}/period
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <StatusPill label={subscription.enabled ? "Active" : "Disabled"} tone={subscription.enabled ? "success" : "neutral"} />
                    <button type="button" onClick={() => setShowHistory(true)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white" title="Adjustment history">
                        <History className="h-3.5 w-3.5" />
                    </button>
                    <Button type="button" size="sm" variant="outline" className="h-8 rounded-lg px-2.5 text-[11px]" onClick={() => setShowAdjust(true)}>Adjust balance</Button>
                    <Button type="button" size="sm" variant="outline" className="h-8 rounded-lg px-2.5 text-[11px]" onClick={confirmRenewal} disabled={busy}>Confirm renewal</Button>
                    <button type="button" onClick={() => setEditing(true)} className="text-[11px] text-white/50 hover:text-white/80 px-2">Edit</button>
                    <button
                        type="button" onClick={toggleEnabled} disabled={busy}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${subscription.enabled ? "border-white/15 text-white/50" : "border-emerald-500/30 text-emerald-300"}`}
                    >
                        {subscription.enabled ? "Disable" : "Enable"}
                    </button>
                </div>
            </div>
            {showAdjust && (
                <AdjustBalanceDialog subscription={subscription} onClose={() => setShowAdjust(false)} onAdjusted={onChanged} />
            )}
            {showHistory && (
                <AdjustmentHistoryDialog subscription={subscription} onClose={() => setShowHistory(false)} />
            )}
        </>
    );
}

// ─── device row (editable) ──────────────────────────────────────────────

function DeviceRow({ device, subscriptions, onChanged }) {
    const [busy, setBusy] = useState(false);

    const assignSubscription = async (e) => {
        const value = e.target.value;
        setBusy(true);
        try {
            if (value === "") {
                await updateOperationsCatdbDevice(device.device_id, { unassignSubscription: true });
            } else {
                await updateOperationsCatdbDevice(device.device_id, { subscriptionId: Number(value) });
            }
            toast.success("Device subscription updated");
            onChanged();
        } catch (e2) {
            toast.error(apiErrorMessage(e2, "Failed to update device"));
        } finally {
            setBusy(false);
        }
    };

    const toggleEnabled = async () => {
        setBusy(true);
        try {
            await updateOperationsCatdbDevice(device.device_id, { enabled: !device.device_enabled });
            toast.success(device.device_enabled ? "Device disabled" : "Device enabled");
            onChanged();
        } catch (e2) {
            toast.error(apiErrorMessage(e2, "Failed to update device"));
        } finally {
            setBusy(false);
        }
    };

    return (
        <tr className="odd:bg-white/[0.02]">
            <td className="px-3 py-2 border-b border-white/5 whitespace-nowrap">
                <div className="font-bold text-white/85">{device.device_name}</div>
                <div className="text-white/35">{device.device_identifier || "—"}</div>
            </td>
            <td className="px-3 py-2 border-b border-white/5 whitespace-nowrap">
                <select
                    value={device.subscription_id ?? ""} onChange={assignSubscription} disabled={busy}
                    className="h-8 rounded-lg bg-white/5 border border-white/10 text-xs px-2 text-white/80"
                >
                    <option value="">Unassigned</option>
                    {subscriptions.map((s) => (
                        <option key={s.id} value={s.id}>{s.display_name} ({s.account_email})</option>
                    ))}
                </select>
            </td>
            <td className="px-3 py-2 border-b border-white/5 whitespace-nowrap text-white/60">{device.reset_day ?? "—"}</td>
            <td className="px-3 py-2 border-b border-white/5 whitespace-nowrap text-white/60">{fmtCount(device.monthly_limit)}</td>
            <td className="px-3 py-2 border-b border-white/5 whitespace-nowrap text-white/60">{fmtCount(device.searches_used)}</td>
            <td className="px-3 py-2 border-b border-white/5 whitespace-nowrap text-white/60">{fmtCount(device.searches_reserved)}</td>
            <td className="px-3 py-2 border-b border-white/5 whitespace-nowrap text-white/80 font-bold">{fmtCount(device.searches_remaining)}</td>
            <td className="px-3 py-2 border-b border-white/5 whitespace-nowrap">
                <StatusPill label={device.device_status} tone={device.device_status === "ONLINE" ? "success" : device.device_status === "AUTH_REQUIRED" ? "danger" : "neutral"} />
            </td>
            <td className="px-3 py-2 border-b border-white/5 whitespace-nowrap text-white/40">{fmtDate(device.last_activity)}</td>
            <td className="px-3 py-2 border-b border-white/5 whitespace-nowrap">
                <button
                    type="button" onClick={toggleEnabled} disabled={busy}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${device.device_enabled ? "border-white/15 text-white/50" : "border-emerald-500/30 text-emerald-300"}`}
                >
                    {device.device_enabled ? "Deactivate" : "Activate"}
                </button>
            </td>
        </tr>
    );
}

// ─── page ────────────────────────────────────────────────────────────────

export default function CatdbSettingsPage() {
    const [subscriptions, setSubscriptions] = useState(null);
    const [devices, setDevices] = useState(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);

    // Polling, not a websocket — same pattern as the Operations batch
    // detail page's own live-progress loop (src/app/operations/[id]/page.js)
    // — so every counter on this page (used/reserved/remaining,
    // per-device state) updates without the admin ever reloading,
    // satisfying Section 5's own requirement.
    const load = useCallback(async () => {
        try {
            const [subsData, devicesData] = await Promise.all([
                listOperationsCatdbSubscriptions(),
                listOperationsCatdbDevices(),
            ]);
            setSubscriptions(Array.isArray(subsData?.items) ? subsData.items : []);
            setDevices(Array.isArray(devicesData?.items) ? devicesData.items : []);
            setError("");
        } catch (e) {
            setError(apiErrorMessage(e, "Failed to load CatDB subscriptions/devices"));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
        const interval = setInterval(load, 15000);
        return () => clearInterval(interval);
    }, [load]);

    const subscriptionsById = useMemo(() => {
        const map = new Map();
        (subscriptions || []).forEach((s) => map.set(s.id, s));
        return map;
    }, [subscriptions]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <Link href="/operations" className="inline-flex items-center gap-1.5 text-[11px] text-white/40 hover:text-white/70 mb-2">
                        <ArrowLeft className="h-3 w-3" /> Back to Operations
                    </Link>
                    <h1 className="text-xl font-black uppercase tracking-tight text-white/90 inline-flex items-center gap-2">
                        <Settings2 className="h-5 w-5 text-emerald-400" /> CatDB Devices &amp; Subscriptions
                    </h1>
                    <p className="text-xs text-white/40 mt-1">
                        Manage CatDB accounts, their monthly quota, and the physical devices assigned to each —
                        required before enabling automatic CatDB VIN searches in Operations.
                    </p>
                </div>
                <button type="button" onClick={load} className="p-2 rounded-xl hover:bg-white/10 text-white/40 hover:text-white" title="Refresh">
                    <RefreshCw className="h-4 w-4" />
                </button>
            </div>

            {error && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">{error}</div>
            )}

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-white/40">CatDB Subscriptions</h2>
                    <NewSubscriptionForm onCreated={load} />
                </div>

                {loading && subscriptions === null ? (
                    <div className="flex items-center gap-2 text-white/40 text-sm py-6 justify-center"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
                ) : !subscriptions?.length ? (
                    <div className="text-xs text-white/35 italic">No CatDB subscriptions configured yet. Create one above.</div>
                ) : (
                    <div className="space-y-2">
                        {subscriptions.map((s) => (
                            <SubscriptionRow key={s.id} subscription={s} onChanged={load} />
                        ))}
                    </div>
                )}
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-white/40 inline-flex items-center gap-1.5">
                        <Smartphone className="h-3.5 w-3.5" /> CatDB Devices
                    </h2>
                </div>

                {loading && devices === null ? (
                    <div className="flex items-center gap-2 text-white/40 text-sm py-6 justify-center"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
                ) : !devices?.length ? (
                    <div className="text-xs text-white/35 italic">No CatDB devices registered yet.</div>
                ) : (
                    <div className="overflow-auto rounded-xl border border-white/10 bg-black/25">
                        <table className="w-full text-xs">
                            <thead className="bg-black/40 sticky top-0">
                                <tr>
                                    {["Device", "Subscription", "Reset day", "Limit", "Used", "Reserved", "Available", "Status", "Last activity", ""].map((h) => (
                                        <th key={h} className="px-3 py-2 text-left uppercase tracking-wider text-white/50 font-bold border-b border-white/10 whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {devices.map((d) => (
                                    <DeviceRow key={d.device_id} device={d} subscriptions={subscriptions || []} onChanged={load} />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
