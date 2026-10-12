"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, ChevronRight, AlertTriangle } from "lucide-react";

import { listCaptures, CAPTURE_STATUS } from "@/lib/catalytic/workerCaptures";
import CaptureStatusBadge from "@/components/catalytic/CaptureStatusBadge";

function fmtRelative(s) {
    if (!s) return "—";
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return "—";
    const diffMs = Date.now() - d.getTime();
    const mins = Math.round(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    return `${days}d ago`;
}

function CaptureCard({ capture, highlight }) {
    const router = useRouter();
    return (
        <button
            type="button"
            onClick={() => router.push(`/worker/captures/${capture.id}`)}
            className={`w-full flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
                highlight ? "border-rose-500/30 bg-rose-500/[0.06]" : "border-white/10 bg-white/[0.02]"
            }`}
        >
            <div className="min-w-0">
                <div className="text-sm font-bold text-white/90 truncate">
                    {[capture.year, capture.make, capture.model].filter(Boolean).join(" ") || capture.vin || `Capture #${capture.id}`}
                </div>
                <div className="text-[11px] text-white/40 mt-0.5 flex items-center gap-2 flex-wrap">
                    {capture.vin && <span className="font-mono">{capture.vin}</span>}
                    <span>
                        {capture.catalysts?.length || 0} catalyst{capture.catalysts?.length === 1 ? "" : "s"}
                    </span>
                    <span>· {fmtRelative(capture.updated_at)}</span>
                </div>
                {highlight && (
                    <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-rose-300">
                        <AlertTriangle className="h-3 w-3" /> Action required
                    </div>
                )}
            </div>
            <CaptureStatusBadge status={capture.status} />
        </button>
    );
}

function Section({ title, captures, highlight }) {
    if (!captures.length) return null;
    return (
        <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-white/50 mb-2">
                {title} ({captures.length})
            </h2>
            <div className="space-y-2">
                {captures.map((c) => (
                    <CaptureCard key={c.id} capture={c} highlight={highlight} />
                ))}
            </div>
        </div>
    );
}

export default function WorkerHomePage() {
    const router = useRouter();
    const [captures, setCaptures] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        listCaptures()
            .then((data) => setCaptures(Array.isArray(data) ? data : []))
            .catch(() => setError("Could not load your submissions"));
    }, []);

    // Grouped so a worker always sees what needs their attention first —
    // REJECTED (needs a fix before it can move forward) above everything
    // else, then DRAFT (unfinished work), then PENDING_REVIEW, then
    // APPROVED last (nothing left to do). This is this worker's OWN
    // captures only — the backend already scopes /worker/captures to the
    // caller, never another worker's data.
    const rejected = (captures || []).filter((c) => c.status === CAPTURE_STATUS.REJECTED);
    const drafts = (captures || []).filter((c) => c.status === CAPTURE_STATUS.DRAFT);
    const pending = (captures || []).filter((c) => c.status === CAPTURE_STATUS.PENDING_REVIEW);
    const approved = (captures || []).filter((c) => c.status === CAPTURE_STATUS.APPROVED);

    return (
        <div className="space-y-6">
            <button
                type="button"
                onClick={() => router.push("/worker/captures/new")}
                className="w-full h-32 rounded-3xl bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] transition-all text-black flex flex-col items-center justify-center gap-2 shadow-[0_16px_32px_-12px_rgba(16,185,129,0.5)]"
            >
                <Plus className="h-8 w-8" />
                <span className="text-lg font-black uppercase tracking-wider">New Vehicle</span>
            </button>

            {captures === null && !error ? (
                <div className="flex items-center gap-2 text-white/40 text-sm py-6 justify-center">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </div>
            ) : error ? (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium">{error}</div>
            ) : captures.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center text-sm text-white/40">
                    No vehicles yet — tap New Vehicle to start.
                </div>
            ) : (
                <div className="space-y-5">
                    <Section title="Needs Action" captures={rejected} highlight />
                    <Section title="Draft" captures={drafts} />
                    <Section title="Pending Review" captures={pending} />
                    <Section title="Approved" captures={approved} />
                </div>
            )}

            {captures && captures.length > 0 && (
                <button
                    type="button"
                    onClick={() => router.push("/worker/submissions")}
                    className="w-full text-center text-xs text-emerald-300 hover:text-emerald-200 font-bold inline-flex items-center justify-center gap-0.5 py-2"
                >
                    View all submissions <ChevronRight className="h-3.5 w-3.5" />
                </button>
            )}
        </div>
    );
}
