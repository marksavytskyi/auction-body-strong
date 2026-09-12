"use client";

import React, { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Loader2, Cpu, Plus, RefreshCw, KeyRound, Copy } from "lucide-react";

import {
    getStats,
    listMachines,
    createMachine,
    setMachineActive,
    rotateMachineToken,
    listJobs,
    enqueueJob,
} from "@/lib/catalytic/catdbAdmin";
import { CatalyticApiError } from "@/lib/catalytic/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

export default function CatdbAdminPage() {
    const [stats, setStats] = useState(null);
    const [machines, setMachines] = useState(null);
    const [jobs, setJobs] = useState(null);
    const [jobsError, setJobsError] = useState("");
    const [vin, setVin] = useState("");
    const [enqueuing, setEnqueuing] = useState(false);

    const loadStats = useCallback(() => {
        getStats().then(setStats).catch(() => setStats(null));
    }, []);

    const loadMachines = useCallback(() => {
        listMachines().then((d) => setMachines(Array.isArray(d) ? d : [])).catch(() => setMachines(null));
    }, []);

    const loadJobs = useCallback(() => {
        listJobs({ limit: 100 })
            .then((d) => { setJobs(Array.isArray(d) ? d : []); setJobsError(""); })
            .catch((e) => { setJobs(null); setJobsError(e instanceof CatalyticApiError ? e.message : "Failed to load jobs"); });
    }, []);

    useEffect(() => {
        loadStats();
        loadMachines();
        loadJobs();
    }, [loadStats, loadMachines, loadJobs]);

    const handleEnqueue = async (e) => {
        e.preventDefault();
        const v = vin.trim().toUpperCase();
        if (v.length !== 17) {
            toast.error("VIN must be 17 characters");
            return;
        }
        setEnqueuing(true);
        try {
            await enqueueJob({ vin: v });
            toast.success("CatDB job queued");
            setVin("");
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
                <p className="text-xs text-white/40 mt-1">Admin-only. Workers never see this — CatDB pricing/status is not exposed to the WORKER role.</p>
            </div>

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

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-white/40">CatDB Machines</h2>
                    <button type="button" onClick={loadMachines} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white"><RefreshCw className="h-3.5 w-3.5" /></button>
                </div>

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
                                        {m.device_identifier || "unknown device"} · last seen {fmtDate(m.last_seen_at)}
                                        {m.current_job_id && <span className="text-sky-300"> · running job #{m.current_job_id}</span>}
                                    </div>
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

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-white/40">CatDB Jobs</h2>
                    <form onSubmit={handleEnqueue} className="flex gap-2">
                        <Input value={vin} onChange={(e) => setVin(e.target.value)} maxLength={17} placeholder="VIN to queue" className="h-9 w-44 rounded-xl bg-white/5 border-white/10 font-mono uppercase text-xs" />
                        <Button type="submit" size="sm" className="h-9 rounded-xl px-3" isLoading={enqueuing}>Enqueue</Button>
                    </form>
                </div>

                {jobsError ? (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">{jobsError}</div>
                ) : jobs === null ? (
                    <div className="flex items-center gap-2 text-white/40 text-sm py-6 justify-center"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
                ) : !jobs.length ? (
                    <div className="text-xs text-white/35 italic">No jobs yet.</div>
                ) : (
                    <div className="overflow-auto rounded-xl border border-white/10 bg-black/25 max-h-[50vh]">
                        <table className="w-full text-xs">
                            <thead className="bg-black/40 sticky top-0">
                                <tr>
                                    {["VIN", "Status", "Attempts", "Worker", "Queued", "Error"].map((h) => (
                                        <th key={h} className="px-3 py-2 text-left uppercase tracking-wider text-white/50 font-bold border-b border-white/10 whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {jobs.map((j) => (
                                    <tr key={j.id} className="odd:bg-white/[0.02]">
                                        <td className="px-3 py-2 border-b border-white/5 font-mono text-white/80 whitespace-nowrap">{j.vin}</td>
                                        <td className="px-3 py-2 border-b border-white/5 whitespace-nowrap">{j.status}</td>
                                        <td className="px-3 py-2 border-b border-white/5 text-white/60 whitespace-nowrap">{j.attempt_count}/{j.max_attempts}</td>
                                        <td className="px-3 py-2 border-b border-white/5 text-white/60 whitespace-nowrap">{j.worker_id ?? "—"}</td>
                                        <td className="px-3 py-2 border-b border-white/5 text-white/40 whitespace-nowrap">{fmtDate(j.queued_at)}</td>
                                        <td className="px-3 py-2 border-b border-white/5 text-rose-300/80 max-w-[220px] truncate" title={j.error_message}>{j.error_message}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
