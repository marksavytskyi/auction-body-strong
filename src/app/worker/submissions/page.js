"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";

import { listCaptures, CAPTURE_STATUS } from "@/lib/catalytic/workerCaptures";
import { CatalyticApiError } from "@/lib/catalytic/api";
import CaptureStatusBadge from "@/components/catalytic/CaptureStatusBadge";

const FILTERS = [
    { id: "", label: "All" },
    { id: CAPTURE_STATUS.DRAFT, label: "Draft" },
    { id: CAPTURE_STATUS.PENDING_REVIEW, label: "Pending" },
    { id: CAPTURE_STATUS.APPROVED, label: "Approved" },
    { id: CAPTURE_STATUS.REJECTED, label: "Rejected" },
];

function fmtDate(s) {
    if (!s) return "—";
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString();
}

export default function MySubmissionsPage() {
    const router = useRouter();
    const [filter, setFilter] = useState("");
    const [captures, setCaptures] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");

    const load = useCallback(async (status) => {
        setIsLoading(true);
        setError("");
        try {
            const data = await listCaptures(status ? { status } : {});
            setCaptures(Array.isArray(data) ? data : []);
        } catch (e) {
            setError(e instanceof CatalyticApiError ? e.message : "Failed to load submissions");
            setCaptures(null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        load(filter);
    }, [filter, load]);

    return (
        <div className="space-y-4">
            <button type="button" onClick={() => router.push("/worker")} className="inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white">
                <ArrowLeft className="h-3.5 w-3.5" /> Home
            </button>

            <h1 className="text-lg font-black uppercase tracking-wide text-white/90">My Submissions</h1>

            <div className="flex flex-wrap gap-1.5">
                {FILTERS.map((f) => (
                    <button
                        key={f.id}
                        type="button"
                        onClick={() => setFilter(f.id)}
                        className={`px-3 h-8 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all ${
                            filter === f.id ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300" : "border border-white/10 text-white/50"
                        }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {isLoading ? (
                <div className="flex items-center gap-2 text-white/40 text-sm py-10 justify-center"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
            ) : error ? (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium">{error}</div>
            ) : !captures || captures.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-white/40">No submissions in this category.</div>
            ) : (
                <div className="space-y-2">
                    {captures.map((c) => (
                        <button
                            key={c.id}
                            type="button"
                            onClick={() => router.push(`/worker/captures/${c.id}`)}
                            className="w-full rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-left"
                        >
                            <div className="flex items-center justify-between gap-3">
                                <div className="text-sm font-bold text-white/90 truncate">
                                    {[c.year, c.make, c.model].filter(Boolean).join(" ") || c.vin || `Capture #${c.id}`}
                                </div>
                                <CaptureStatusBadge status={c.status} />
                            </div>
                            <div className="flex items-center justify-between mt-1.5 text-[11px] text-white/40">
                                <span>{fmtDate(c.created_at)} · {c.catalysts?.length || 0} catalyst{c.catalysts?.length === 1 ? "" : "s"}</span>
                            </div>
                            {c.status === CAPTURE_STATUS.REJECTED && c.moderator_notes && (
                                <div className="mt-2 text-[11px] text-rose-300/80 italic">{c.moderator_notes}</div>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
