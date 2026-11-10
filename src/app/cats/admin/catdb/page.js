"use client";

import React, { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Loader2, Cpu, Plus, RefreshCw, KeyRound, Copy, ChevronDown, ChevronRight } from "lucide-react";

import {
    getStats,
    listMachines,
    createMachine,
    setMachineActive,
    rotateMachineToken,
    enqueueJob,
} from "@/lib/catalytic/catdbAdmin";
import { listBatches } from "@/lib/catalytic/catdbBatch";
import CatdbProcessingControls from "@/components/catalytic/CatdbProcessingControls";
import { CatalyticApiError } from "@/lib/catalytic/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import CatdbJobsPanel from "@/components/catalytic/CatdbJobsPanel";
import CatdbDevicesSubscriptions from "@/components/catalytic/CatdbDevicesSubscriptions";
import { ConfirmDialog } from "@/components/catalytic/CatdbProcessingControls";

const MACHINE_STATUS_TONE = {
    ONLINE: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    BUSY: "border-sky-500/30 bg-sky-500/10 text-sky-300",
    DEGRADED: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    AUTH_REQUIRED: "border-rose-500/30 bg-rose-500/10 text-rose-300",
    OFFLINE: "border-white/15 bg-white/5 text-white/40",
};

function MachineStatusBadge({ status }) {
    const key = String(status || "").toUpperCase();
    const tone = MACHINE_STATUS_TONE[key] || "border-white/15 bg-white/5 text-white/40";
    return <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap ${tone}`}>{key || "UNKNOWN"}</span>;
}

function fmtDate(s) {
    if (!s) return "—";
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? s : d.toLocaleString();
}

function NewMachineForm({ onCreated }) {
    const [name, setName] = useState("");
    const [busy, setBusy] = useState(false);
    const [issuedToken, setIssuedToken] = useState(null);

    const submit = async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        setBusy(true);
        try {
            const res = await createMachine(name.trim());
            setIssuedToken(res.token);
            setName("");
            onCreated();
        } catch (e2) {
            toast.error(e2 instanceof CatalyticApiError ? e2.message : "Failed to create machine");
        } finally {
            setBusy(false);
        }
    };

    if (issuedToken) {
        return (
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-3 space-y-2">
                <p className="text-[11px] text-amber-200/80">This token is shown once — copy it into the CatDB Android device now.</p>
                <div className="flex items-center gap-2">
                    <code className="flex-1 text-[11px] text-white/80 bg-black/40 rounded-lg px-2 py-1.5 overflow-x-auto whitespace-nowrap">{issuedToken}</code>
                    <button type="button" onClick={() => { navigator.clipboard?.writeText(issuedToken); toast.success("Copied"); }} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50">
                        <Copy className="h-3.5 w-3.5" />
                    </button>
                </div>
                <button type="button" onClick={() => setIssuedToken(null)} className="text-[11px] text-white/40 hover:text-white/70">Done</button>
            </div>
        );
    }

    return (
        <form onSubmit={submit} className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Machine name (e.g. pixel-7-01)" className="h-10 rounded-xl bg-white/5 border-white/10" />
            <Button type="submit" size="sm" className="h-10 rounded-xl px-4" isLoading={busy}>
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Register
            </Button>
        </form>
    );
}

// How long ago, in words, for a heartbeat.
function ago(value) {
    if (!value) return "never";
    const d = new Date(`${value}`.endsWith("Z") ? value : `${value}Z`);
    const seconds = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000));
    if (seconds < 90) return `${seconds}s ago`;
    if (seconds < 5400) return `${Math.round(seconds / 60)} min ago`;
    if (seconds < 172800) return `${Math.round(seconds / 3600)} h ago`;
    return `${Math.round(seconds / 86400)} days ago`;
}

const STOP_LABEL = { NONE: "No stop request", REQUEST_SENT: "Stop requested, not yet confirmed by the device", WORKER_STOPPED: "Stopped, confirmed by the device" };

function stopState(machine) {
    if (!machine.stop_requested_at) return "NONE";
    return machine.stop_acknowledged_at ? "WORKER_STOPPED" : "REQUEST_SENT";
}

// Phase K.51: the old CatDB Batches page, kept as read-only history. Its pause, resume,
// cancel and start buttons are gone; batch processing lives in Operations.
function LegacyBatchHistory() {
    const [open, setOpen] = useState(false);
    const [batches, setBatches] = useState(null);
    useEffect(() => {
        if (open && batches === null) listBatches({ limit: 100 }).then((d) => setBatches(Array.isArray(d) ? d : [])).catch(() => setBatches([]));
    }, [open, batches]);
    return (
        <section aria-label="Legacy CatDB batches" className="rounded-2xl border border-white/10 bg-white/[0.02]">
            <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="flex min-h-11 w-full items-center gap-2 px-4 text-left text-xs font-bold uppercase tracking-wider text-white/50">
                {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />} Legacy CatDB batches (history)
            </button>
            {open && (
                <div className="px-4 pb-4 text-xs text-white/60">
                    {batches === null ? <Loader2 className="h-4 w-4 animate-spin" /> : !batches.length ? "None." : (
                        <ul className="space-y-1">
                            {batches.map((b) => (
                                <li key={b.id} className="flex flex-wrap justify-between gap-x-3">
                                    <span>Batch #{b.id} · {b.status} · up to {b.requested_limit} VINs from Copart import #{b.copart_import_id}{b.stopped_reason ? ` · ${b.stopped_reason}` : ""}</span>
                                    <span className="text-white/40">{fmtDate(b.created_at)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                    <p className="mt-2 text-[11px] text-white/35">Read-only. Batch processing now lives in Operations; each job of these batches is in the list above.</p>
                </div>
            )}
        </section>
    );
}

// Phase K.53: the Devices & Subscriptions management, moved here unchanged from Operations →
// Settings. Closed by default; the old address opens it (?section=subscriptions).
function DevicesAndSubscriptions() {
    const [open, setOpen] = useState(false);
    useEffect(() => {
        if (new URLSearchParams(window.location.search).get("section") === "subscriptions") {
            setOpen(true);
            requestAnimationFrame(() => document.getElementById("devices-subscriptions")?.scrollIntoView({ block: "start" }));
        }
    }, []);
    return (
        <section id="devices-subscriptions" aria-label="Devices and subscriptions" className="scroll-mt-4 rounded-3xl border border-white/10 bg-white/[0.03]">
            <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)}
                className="flex min-h-11 w-full items-center gap-2 px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-white/60 sm:px-6">
                {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />} Devices &amp; Subscriptions
                <span className="font-normal normal-case tracking-normal text-white/35">accounts, monthly quota, device assignment</span>
            </button>
            {open && <div className="px-5 pb-5 sm:px-6 sm:pb-6"><CatdbDevicesSubscriptions /></div>}
        </section>
    );
}

export default function CatdbAdminPage() {
    const [stats, setStats] = useState(null);
    const [machines, setMachines] = useState(null);
    const [jobsRefresh, setJobsRefresh] = useState(0);
    const [vin, setVin] = useState("");
    const [confirmVin, setConfirmVin] = useState(null);
    const [enqueuing, setEnqueuing] = useState(false);
    const [paused, setPaused] = useState(null);

    const loadStats = useCallback(() => {
        getStats().then(setStats).catch(() => setStats(null));
    }, []);

    const loadMachines = useCallback(() => {
        listMachines().then((d) => {
            const list = Array.isArray(d) ? d : [];
            setMachines(list);
            if (list.length) setPaused(Boolean(list[0].dispatch_paused));
        }).catch(() => setMachines(null));
    }, []);

    const loadJobs = useCallback(() => setJobsRefresh((key) => key + 1), []);

    useEffect(() => {
        loadStats();
        loadMachines();
    }, [loadStats, loadMachines]);

    // A new VIN may use a paid search, so it asks first.
    const askEnqueue = (e) => {
        e.preventDefault();
        const v = vin.trim().toUpperCase();
        if (v.length !== 17) {
            toast.error("VIN must be 17 characters");
            return;
        }
        setConfirmVin(v);
    };

    const enqueue = async () => {
        setEnqueuing(true);
        try {
            const job = await enqueueJob({ vin: confirmVin });
            toast.success(`CatDB job #${job.id} queued`);
            setVin("");
            setConfirmVin(null);
            loadJobs();
            loadStats();
        } catch (e2) {
            toast.error(e2 instanceof CatalyticApiError ? e2.message : "Failed to enqueue job");
        } finally {
            setEnqueuing(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-black uppercase tracking-tight text-white/90 inline-flex items-center gap-2">
                    <Cpu className="h-5 w-5 text-sky-400" /> CatDB Automation
                </h1>
                <p className="text-xs text-white/40 mt-1">Paid VIN searches and the Android devices that run them. Admin-only; vehicle batches are in Operations.</p>
            </div>

            <CatdbProcessingControls onChanged={() => { loadJobs(); loadStats(); loadMachines(); }} />

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                    { label: "Pending", value: stats?.pending },
                    { label: "Running", value: stats?.running },
                    { label: "Completed Today", value: stats?.completed_today },
                    { label: "Failed Today", value: stats?.failed_today, danger: true },
                    { label: "Avg Duration", value: stats?.avg_duration_seconds ? `${Math.round(stats.avg_duration_seconds)}s` : "—" },
                ].map((s) => (
                    <div key={s.label} className={`rounded-xl border p-3 text-center ${s.danger && s.value > 0 ? "border-rose-500/25 bg-rose-500/[0.05]" : "border-white/10 bg-black/25"}`}>
                        <div className="text-xl font-black text-white/90">{stats ? s.value ?? "—" : <Loader2 className="h-4 w-4 animate-spin mx-auto text-white/30" />}</div>
                        <div className="text-[10px] uppercase tracking-wider text-white/40 font-bold mt-0.5">{s.label}</div>
                    </div>
                ))}
            </div>
            {stats?.recent_errors?.length > 0 && (
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.04] p-4">
                    <div className="text-xs font-bold uppercase tracking-wider text-rose-300 mb-2">Recent Errors</div>
                    <div className="space-y-1.5">
                        {stats.recent_errors.map((e, i) => (
                            <div key={i} className="text-xs text-white/60 flex items-center justify-between gap-2">
                                <span className="font-mono">{e.vin}</span>
                                <span className="text-white/40">{e.error_code}</span>
                                <span className="text-rose-300/80 truncate max-w-[40%]">{e.error_message}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-white/40">CatDB Machines</h2>
                    <button type="button" onClick={loadMachines} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white"><RefreshCw className="h-3.5 w-3.5" /></button>
                </div>

                <p className="text-[11px] text-white/35">
                    A heartbeat only means the device&apos;s app is reachable. It runs searches only while CatDB processing is running and it has no stop request.
                </p>

                <NewMachineForm onCreated={loadMachines} />

                {machines === null ? (
                    <div className="text-xs text-white/35 italic">Failed to load machines.</div>
                ) : !machines.length ? (
                    <div className="text-xs text-white/35 italic">No machines registered yet.</div>
                ) : (
                    <div className="space-y-2">
                        {machines.map((m) => (
                            <div key={m.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 flex-wrap">
                                <div>
                                    <div className="font-bold text-sm text-white/90">{m.name}</div>
                                    <div className="text-[11px] text-white/40">
                                        {m.device_identifier || "unknown device"} · {m.is_active ? "registered" : "token revoked"}
                                        {m.current_job_id && <span className="text-sky-300"> · working on job #{m.current_job_id}</span>}
                                    </div>
                                    <dl className="mt-1 grid gap-x-4 gap-y-0.5 text-[11px] text-white/55 sm:grid-cols-2">
                                        <div>Last heartbeat: <b className="text-white/75">{ago(m.last_seen_at)}</b> ({fmtDate(m.last_seen_at)})</div>
                                        <div>App reports: <b className="text-white/75">{m.effective_status || m.status}</b></div>
                                        <div>{STOP_LABEL[stopState(m)]}</div>
                                        <div>CatDB processing: <b className={m.dispatch_paused ? "text-amber-200" : "text-emerald-300"}>{m.dispatch_paused ? "paused for every device" : "running"}</b></div>
                                    </dl>
                                </div>
                                <div className="flex items-center gap-2">
                                    <MachineStatusBadge status={m.effective_status || m.status} />
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            try {
                                                await setMachineActive(m.id, !m.is_active);
                                                toast.success(m.is_active ? "Deactivated" : "Activated");
                                                loadMachines();
                                            } catch (e) {
                                                toast.error(e instanceof CatalyticApiError ? e.message : "Failed to update");
                                            }
                                        }}
                                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${m.is_active ? "border-white/15 text-white/50" : "border-emerald-500/30 text-emerald-300"}`}
                                    >
                                        {m.is_active ? "Deactivate" : "Activate"}
                                    </button>
                                    <button
                                        type="button"
                                        title="Rotate token"
                                        onClick={async () => {
                                            if (!confirm(`Rotate token for ${m.name}? The old token stops working immediately.`)) return;
                                            try {
                                                const res = await rotateMachineToken(m.id);
                                                await navigator.clipboard?.writeText(res.token);
                                                toast.success("New token copied to clipboard");
                                            } catch (e) {
                                                toast.error(e instanceof CatalyticApiError ? e.message : "Failed to rotate token");
                                            }
                                        }}
                                        className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white"
                                    >
                                        <KeyRound className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-white/40">CatDB Jobs</h2>
                    <form onSubmit={askEnqueue} className="flex gap-2">
                        <Input value={vin} onChange={(e) => setVin(e.target.value)} maxLength={17} placeholder="VIN to queue" aria-label="VIN to queue" className="h-9 w-44 rounded-xl bg-white/5 border-white/10 font-mono uppercase text-xs" />
                        <Button type="submit" size="sm" className="h-9 rounded-xl px-3">Enqueue…</Button>
                    </form>
                </div>
                <CatdbJobsPanel refreshKey={jobsRefresh} onChanged={() => { loadStats(); loadMachines(); }} />
            </div>

            <DevicesAndSubscriptions />

            <LegacyBatchHistory />

            {confirmVin && (
                <ConfirmDialog
                    action={{
                        title: `Queue a CatDB search for ${confirmVin}?`,
                        body: `This may use a paid search from your CatDB subscription. ${paused ? "CatDB processing is paused, so the job waits until it is resumed." : "CatDB processing is running, so a device may pick it up right away."} A VIN that is already queued or running isn't queued twice.`,
                        confirm: "Queue search",
                    }}
                    busy={enqueuing}
                    onConfirm={enqueue}
                    onClose={() => setConfirmVin(null)}
                />
            )}
        </div>
    );
}
