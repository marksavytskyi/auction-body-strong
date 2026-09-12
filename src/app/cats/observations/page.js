"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, ClipboardList, RefreshCw, Info } from "lucide-react";

import { listObservations, CatalyticApiError } from "@/lib/catalytic/api";
import { SourceBadge } from "@/components/catalytic/badges";
import { useAdminTierGate } from "@/hooks/useRoleGate";

function fmtDate(s) {
    if (!s) return "—";
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? s : d.toLocaleString();
}

// ObservationResponse (verified against the live schema) only carries
// `verified_by` as a provenance signal — there is no submitted_by_user_id /
// approved_by_user_id / approved_at / source_capture_id to link an
// observation back to the worker capture that produced it. See BACKEND
// GAPS in the delivery report: cross-referencing every capture to find a
// matching approved_observation_id would mean downloading the entire
// capture history, which this page deliberately does not do.
export default function ObservationsAdminPage() {
    const { ready } = useAdminTierGate();
    const [observations, setObservations] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        setIsLoading(true);
        setError("");
        try {
            const data = await listObservations({ limit: 200 });
            setObservations(Array.isArray(data) ? data : []);
        } catch (e) {
            setError(e instanceof CatalyticApiError ? e.message : "Failed to load observations");
            setObservations(null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (ready) load();
    }, [ready, load]);

    if (!ready) return null;

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <h1 className="text-xl font-black uppercase tracking-tight text-white/90 inline-flex items-center gap-2">
                        <ClipboardList className="h-5 w-5 text-emerald-400" /> Observations
                    </h1>
                    <p className="text-xs text-white/40 mt-1">Trusted catalytic knowledge base — every row here already contributed to pricing/confidence.</p>
                </div>
                <button type="button" onClick={load} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white"><RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} /></button>
            </div>

            <div className="rounded-xl border border-sky-500/15 bg-sky-500/[0.04] p-3 flex items-start gap-2">
                <Info className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-sky-200/70">
                    Full provenance (which worker submitted it, which moderator approved it, when) isn&apos;t exposed by this endpoint yet — only &quot;verified by&quot; is available. See the delivery report&apos;s backend gaps for the fields needed.
                </p>
            </div>

            {isLoading ? (
                <div className="flex items-center gap-2 text-white/50 text-sm py-12 justify-center"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
            ) : error ? (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium">{error}</div>
            ) : !observations || observations.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/25 p-8 text-center text-sm text-white/45">No observations recorded yet.</div>
            ) : (
                <div className="overflow-auto rounded-2xl border border-white/10 bg-black/25">
                    <table className="w-full text-sm">
                        <thead className="bg-black/40 sticky top-0">
                            <tr>
                                {["Code", "Converter", "Vehicle Key", "Verified By", "Notes", "Recorded"].map((h) => (
                                    <th key={h} className="px-4 py-2.5 text-left text-[11px] uppercase tracking-wider text-white/50 font-bold border-b border-white/10 whitespace-nowrap">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {observations.map((o) => (
                                <tr key={o.id} className="odd:bg-white/[0.02]">
                                    <td className="px-4 py-2.5 border-b border-white/5 font-mono text-white/85 whitespace-nowrap">{o.physical_code_raw || "—"}</td>
                                    <td className="px-4 py-2.5 border-b border-white/5 text-white/60 whitespace-nowrap">{o.converter_id ?? "—"}</td>
                                    <td className="px-4 py-2.5 border-b border-white/5 text-white/60 whitespace-nowrap">{o.vehicle_key_id ?? "—"}</td>
                                    <td className="px-4 py-2.5 border-b border-white/5 whitespace-nowrap">
                                        <SourceBadge source={{ code: o.verified_by || "MANUAL", label: o.verified_by || "manual", tone: "verified" }} />
                                    </td>
                                    <td className="px-4 py-2.5 border-b border-white/5 text-white/50 max-w-[220px] truncate" title={o.notes}>{o.notes || "—"}</td>
                                    <td className="px-4 py-2.5 border-b border-white/5 text-white/40 whitespace-nowrap">{fmtDate(o.created_at)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
