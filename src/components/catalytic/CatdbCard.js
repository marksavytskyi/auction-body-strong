"use client";

import React from "react";
import { Database, Loader2, Clock, TriangleAlert, CircleSlash } from "lucide-react";
import { CATDB_STATUS } from "@/lib/catalytic/catdb";

function fmtMoney(n, currency = "USD") {
    if (n === null || n === undefined || !Number.isFinite(Number(n))) return "—";
    try {
        return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
    } catch {
        return `$${Math.round(n)}`;
    }
}

function fmtDate(s) {
    if (!s) return null;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d.toLocaleString();
}

const STATUS_META = {
    [CATDB_STATUS.NO_DATA]: { label: "No Data", tone: "border-white/15 bg-white/5 text-white/45", icon: CircleSlash },
    [CATDB_STATUS.PENDING]: { label: "Pending", tone: "border-amber-500/30 bg-amber-500/10 text-amber-300", icon: Clock },
    [CATDB_STATUS.SEARCHING]: { label: "Searching", tone: "border-sky-500/30 bg-sky-500/10 text-sky-300 animate-pulse", icon: Loader2 },
    [CATDB_STATUS.COMPLETE]: { label: "Complete", tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300", icon: Database },
    [CATDB_STATUS.FAILED]: { label: "Failed", tone: "border-rose-500/30 bg-rose-500/10 text-rose-300", icon: TriangleAlert },
};

// CatDB is an external, licensed reference source — never styled or
// labeled in a way that could be mistaken for our own verified data.
export default function CatdbCard({ snapshot }) {
    const meta = STATUS_META[snapshot.status] || STATUS_META[CATDB_STATUS.NO_DATA];
    const Icon = meta.icon;
    const capturedLabel = fmtDate(snapshot.capturedAt);

    return (
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-white/70">
                    <Database className="h-4 w-4 text-sky-400" />
                    CatDB
                </div>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap ${meta.tone}`}>
                    <Icon className={`h-3 w-3 ${snapshot.status === CATDB_STATUS.SEARCHING ? "animate-spin" : ""}`} />
                    {meta.label}
                </span>
            </div>

            <div className="p-5 flex-1 flex flex-col justify-center">
                {snapshot.contractMissing ? (
                    <div className="text-center py-4">
                        <p className="text-sm text-white/45">CatDB integration is not connected yet.</p>
                        <p className="text-[11px] text-white/25 mt-1">This card will populate automatically once the CatDB capture service is live.</p>
                    </div>
                ) : snapshot.status === CATDB_STATUS.FAILED ? (
                    <div className="text-center py-4">
                        <p className="text-sm text-rose-300 font-semibold">CatDB search failed</p>
                        {snapshot.error && <p className="text-[11px] text-white/40 mt-1">{snapshot.error}</p>}
                    </div>
                ) : snapshot.status === CATDB_STATUS.PENDING || snapshot.status === CATDB_STATUS.SEARCHING ? (
                    <div className="text-center py-4">
                        <p className="text-sm text-white/60">
                            {snapshot.status === CATDB_STATUS.SEARCHING ? "Searching CatDB…" : "Queued for CatDB search"}
                        </p>
                    </div>
                ) : snapshot.status === CATDB_STATUS.COMPLETE ? (
                    <div className="space-y-3">
                        <div className="flex items-baseline justify-between">
                            <span className="text-xs uppercase tracking-wider text-white/40 font-bold">CatDB Total</span>
                            <span className="text-2xl font-black text-white">{fmtMoney(snapshot.totalPrice, snapshot.currency)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-white/50">
                            <span>{snapshot.catalystCount ?? "—"} catalyst{snapshot.catalystCount === 1 ? "" : "s"}</span>
                            {capturedLabel && <span>Captured {capturedLabel}</span>}
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-4">
                        <p className="text-sm text-white/45">No CatDB data for this vehicle yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
