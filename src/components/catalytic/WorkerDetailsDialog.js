"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { Loader2, X } from "lucide-react";

import { listQueue } from "@/lib/catalytic/moderation";
import { CatalyticApiError } from "@/lib/catalytic/api";
import CaptureStatusBadge from "@/components/catalytic/CaptureStatusBadge";
import { useModalLayer } from "@/hooks/useModalLayer";

// Phase K.51: the former Workers page's details, opened from Users & Roles. The same
// data and counts as before: this person's submissions from the moderation queue
// (newest 500), counted by status. A human worker only; CatDB Android devices are in
// CatDB Automation.
const QUEUE_LIMIT = 500;

function fmtDate(s) {
    if (!s) return "—";
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? s : d.toLocaleString();
}

export default function WorkerDetailsDialog({ user, onClose }) {
    const zIndex = useModalLayer(true, onClose);
    const [captures, setCaptures] = useState(null);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        setError("");
        try {
            const data = await listQueue({ worker_id: user.id, limit: QUEUE_LIMIT });
            setCaptures(Array.isArray(data) ? data : []);
        } catch (e) {
            setError(e instanceof CatalyticApiError ? e.message : "Failed to load this worker's submissions");
        }
    }, [user.id]);

    useEffect(() => { load(); }, [load]);

    const counts = useMemo(() => {
        const c = { total: captures?.length || 0, PENDING_REVIEW: 0, APPROVED: 0, REJECTED: 0, DRAFT: 0 };
        (captures || []).forEach((cap) => { c[cap.status] = (c[cap.status] || 0) + 1; });
        return c;
    }, [captures]);
    const lastActivity = captures?.length ? captures.map((c) => c.submitted_at || c.created_at).filter(Boolean).sort().at(-1) : null;

    return createPortal(
        <div role="dialog" aria-modal="true" aria-label={`Worker details: ${user.email}`} style={{ zIndex }}
            className="fixed inset-0 flex items-end justify-center bg-black/80 p-0 sm:items-center sm:p-3" onClick={onClose}>
            <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-2xl border border-white/10 bg-[#0b0d12] sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start justify-between gap-3 border-b border-white/10 p-4">
                    <div className="min-w-0">
                        <h2 className="break-all text-base font-bold text-white">{user.email}</h2>
                        <div className="mt-1 text-[11px] text-white/45">
                            {user.role} · {user.is_active ? "Active" : "Inactive"} · last submission {fmtDate(lastActivity)}
                        </div>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Close" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg hover:bg-white/10 text-white/60">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="space-y-4 overflow-y-auto p-4">
                    {error ? (
                        <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">
                            {error} <button type="button" onClick={load} className="underline">Retry</button>
                        </div>
                    ) : captures === null ? (
                        <div className="flex items-center justify-center gap-2 py-8 text-sm text-white/50"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                {[
                                    { label: "Total", value: counts.total },
                                    { label: "Pending", value: counts.PENDING_REVIEW },
                                    { label: "Approved", value: counts.APPROVED },
                                    { label: "Rejected", value: counts.REJECTED },
                                ].map((s) => (
                                    <div key={s.label} className="rounded-xl border border-white/10 bg-black/25 p-3 text-center">
                                        <div className="text-xl font-black text-white/90">{s.value}</div>
                                        <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-white/40">{s.label}</div>
                                    </div>
                                ))}
                            </div>
                            {captures.length >= QUEUE_LIMIT && (
                                <p className="text-[11px] text-amber-200/80">Counts cover the newest {QUEUE_LIMIT} submissions.</p>
                            )}
                            <div>
                                <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-white/40">Submissions</h3>
                                {!captures.length ? (
                                    <div className="rounded-xl border border-white/10 bg-black/25 p-5 text-center text-sm text-white/45">No submissions yet.</div>
                                ) : (
                                    <div className="space-y-2">
                                        {captures.map((c) => (
                                            <Link key={c.id} href={`/cats/moderation/${c.id}`}
                                                className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5 hover:bg-white/[0.05]">
                                                <div className="min-w-0">
                                                    <div className="truncate text-sm font-bold text-white/85">
                                                        {[c.year, c.make, c.model].filter(Boolean).join(" ") || c.vin || `Capture #${c.id}`}
                                                    </div>
                                                    <div className="mt-0.5 text-[11px] text-white/40">
                                                        {fmtDate(c.submitted_at || c.created_at)} · {c.catalysts?.length || 0} catalyst{c.catalysts?.length === 1 ? "" : "s"}
                                                    </div>
                                                </div>
                                                <CaptureStatusBadge status={c.status} />
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}
