"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, ChevronRight } from "lucide-react";

import { listCaptures } from "@/lib/catalytic/workerCaptures";
import CaptureStatusBadge from "@/components/catalytic/CaptureStatusBadge";

export default function WorkerHomePage() {
    const router = useRouter();
    const [recent, setRecent] = useState(null);

    useEffect(() => {
        listCaptures()
            .then((data) => setRecent(Array.isArray(data) ? data.slice(0, 5) : []))
            .catch(() => setRecent(null));
    }, []);

    return (
        <div className="space-y-6">
            <button
                type="button"
                onClick={() => router.push("/worker/captures/new")}
                className="w-full h-32 rounded-3xl bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] transition-all text-black flex flex-col items-center justify-center gap-2 shadow-[0_16px_32px_-12px_rgba(16,185,129,0.5)]"
            >
                <Plus className="h-8 w-8" />
                <span className="text-lg font-black uppercase tracking-wider">Add Vehicle</span>
            </button>

            <div>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-white/50">My Recent Submissions</h2>
                    <button type="button" onClick={() => router.push("/worker/submissions")} className="text-xs text-emerald-300 hover:text-emerald-200 font-bold inline-flex items-center gap-0.5">
                        View all <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                </div>

                {recent === null ? (
                    <div className="flex items-center gap-2 text-white/40 text-sm py-6 justify-center"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
                ) : recent.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center text-sm text-white/40">
                        No submissions yet — tap Add Vehicle to start.
                    </div>
                ) : (
                    <div className="space-y-2">
                        {recent.map((c) => (
                            <button
                                key={c.id}
                                type="button"
                                onClick={() => router.push(`/worker/captures/${c.id}`)}
                                className="w-full flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-left"
                            >
                                <div className="min-w-0">
                                    <div className="text-sm font-bold text-white/90 truncate">
                                        {[c.year, c.make, c.model].filter(Boolean).join(" ") || c.vin || `Capture #${c.id}`}
                                    </div>
                                    <div className="text-[11px] text-white/40 mt-0.5">{c.catalysts?.length || 0} catalyst{c.catalysts?.length === 1 ? "" : "s"}</div>
                                </div>
                                <CaptureStatusBadge status={c.status} />
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
