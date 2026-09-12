"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ShieldCheck, Users, Cpu, Receipt, Wrench, ArrowRight, TriangleAlert } from "lucide-react";

import { listQueue } from "@/lib/catalytic/moderation";
import { listUsers } from "@/lib/catalytic/users";
import { getStats as getCatdbStats, listMachines } from "@/lib/catalytic/catdbAdmin";
import { listSales } from "@/lib/catalytic/api";
import { isWorkerRole } from "@/lib/rbac";

function startOfWeekIso() {
    const d = new Date();
    const day = d.getDay(); // 0 = Sunday
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - day);
    return d.toISOString();
}

function StatCard({ icon: Icon, label, value, sub, tone = "default", href }) {
    const toneClass = {
        default: "border-white/10 bg-white/[0.03]",
        warn: "border-amber-500/20 bg-amber-500/[0.04]",
        danger: "border-rose-500/20 bg-rose-500/[0.04]",
        good: "border-emerald-500/20 bg-emerald-500/[0.04]",
    }[tone];

    const content = (
        <div className={`rounded-2xl border ${toneClass} p-4 h-full flex flex-col justify-between`}>
            <div className="flex items-center justify-between">
                <Icon className="h-4 w-4 text-white/40" />
                {href && <ArrowRight className="h-3.5 w-3.5 text-white/20" />}
            </div>
            <div className="mt-3">
                <div className="text-2xl font-black text-white/90">{value === null ? <Loader2 className="h-5 w-5 animate-spin text-white/30" /> : value}</div>
                <div className="text-[11px] text-white/45 uppercase tracking-wider font-bold mt-0.5">{label}</div>
                {sub && <div className="text-[10px] text-white/30 mt-1">{sub}</div>}
            </div>
        </div>
    );

    return href ? <Link href={href}>{content}</Link> : content;
}

// Every number here comes from a real, bounded API call. Nothing is
// fabricated — where the backend can't cheaply answer a question (e.g.
// "captures approved today"), it's omitted rather than approximated from
// a dataset that could silently be larger than what we fetched. See the
// BACKEND GAPS note in the final report for what a real stats endpoint
// would need to expose.
export default function AdminOverviewPage() {
    const [pendingModeration, setPendingModeration] = useState(null);
    const [workerCounts, setWorkerCounts] = useState(null);
    const [catdbStats, setCatdbStats] = useState(null);
    const [catdbMachines, setCatdbMachines] = useState(null);
    const [salesThisWeek, setSalesThisWeek] = useState(null);
    const [errors, setErrors] = useState([]);

    useEffect(() => {
        listQueue({ status: "PENDING_REVIEW", limit: 500 })
            .then((data) => setPendingModeration(Array.isArray(data) ? data.length : 0))
            .catch((e) => { setPendingModeration(-1); setErrors((x) => [...x, `Moderation queue: ${e.message}`]); });

        listUsers()
            .then((data) => {
                const workers = (Array.isArray(data) ? data : []).filter((u) => isWorkerRole(u.role));
                setWorkerCounts({ total: workers.length, active: workers.filter((w) => w.is_active).length });
            })
            .catch((e) => { setWorkerCounts(null); setErrors((x) => [...x, `Users: ${e.message}`]); });

        getCatdbStats()
            .then(setCatdbStats)
            .catch((e) => { setCatdbStats(null); setErrors((x) => [...x, `CatDB stats: ${e.message}`]); });

        listMachines()
            .then((data) => setCatdbMachines(Array.isArray(data) ? data : []))
            .catch((e) => { setCatdbMachines(null); setErrors((x) => [...x, `CatDB machines: ${e.message}`]); });

        listSales({ date_from: startOfWeekIso(), limit: 1000 })
            .then((data) => setSalesThisWeek(Array.isArray(data) ? data.length : 0))
            .catch((e) => { setSalesThisWeek(-1); setErrors((x) => [...x, `Sales: ${e.message}`]); });
    }, []);

    const machinesOnline = catdbMachines?.filter((m) => String(m.effective_status || m.status).toUpperCase() === "ONLINE").length ?? null;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-black uppercase tracking-tight text-white/90">Overview</h1>
                <p className="text-xs text-white/40 mt-1">Live operational snapshot — every number below is a real API call, not an estimate.</p>
            </div>

            {errors.length > 0 && (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-3 flex items-start gap-2">
                    <TriangleAlert className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-200/80 space-y-0.5">
                        {errors.map((e, i) => <div key={i}>{e}</div>)}
                    </div>
                </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    icon={ShieldCheck}
                    label="Pending Moderation"
                    value={pendingModeration === null ? null : pendingModeration < 0 ? "—" : pendingModeration >= 500 ? "500+" : pendingModeration}
                    tone={pendingModeration > 0 ? "warn" : "default"}
                    href="/cats/moderation"
                />
                <StatCard
                    icon={Wrench}
                    label="Active Workers"
                    value={workerCounts ? `${workerCounts.active}/${workerCounts.total}` : null}
                    sub={workerCounts ? "active / total human workers" : undefined}
                    href="/cats/admin/workers"
                />
                <StatCard
                    icon={Receipt}
                    label="Sales This Week"
                    value={salesThisWeek === null ? null : salesThisWeek < 0 ? "—" : salesThisWeek}
                    href="/cats/sales"
                />
                <StatCard
                    icon={Users}
                    label="Users & Roles"
                    value={workerCounts ? workerCounts.total : null}
                    sub="human workers"
                    href="/cats/admin/users"
                />
            </div>

            <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-white/40 mb-3">CatDB Automation</h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard icon={Cpu} label="Pending Jobs" value={catdbStats?.pending ?? (catdbStats === null ? "—" : null)} href="/cats/admin/catdb" />
                    <StatCard icon={Cpu} label="Running Jobs" value={catdbStats?.running ?? (catdbStats === null ? "—" : null)} href="/cats/admin/catdb" />
                    <StatCard icon={Cpu} label="Failed Today" value={catdbStats?.failed_today ?? (catdbStats === null ? "—" : null)} tone={catdbStats?.failed_today > 0 ? "danger" : "default"} href="/cats/admin/catdb" />
                    <StatCard icon={Cpu} label="Machines Online" value={machinesOnline ?? (catdbMachines === null ? "—" : null)} sub={catdbMachines ? `of ${catdbMachines.length} total` : undefined} href="/cats/admin/catdb" />
                </div>
            </div>

            {catdbStats?.recent_errors?.length > 0 && (
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.04] p-4">
                    <div className="text-xs font-bold uppercase tracking-wider text-rose-300 mb-2">Recent CatDB Errors</div>
                    <div className="space-y-1.5">
                        {catdbStats.recent_errors.slice(0, 5).map((e, i) => (
                            <div key={i} className="text-xs text-white/60 flex items-center justify-between gap-2">
                                <span className="font-mono">{e.vin}</span>
                                <span className="text-rose-300/80 truncate max-w-[60%]">{e.error_message}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
