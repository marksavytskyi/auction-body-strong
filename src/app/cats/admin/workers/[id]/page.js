"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";

import { listUsers } from "@/lib/catalytic/users";
import { listQueue } from "@/lib/catalytic/moderation";
import { CatalyticApiError } from "@/lib/catalytic/api";
import CaptureStatusBadge from "@/components/catalytic/CaptureStatusBadge";

function fmtDate(s) {
    if (!s) return "—";
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? s : d.toLocaleString();
}

export default function WorkerDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = Number(params?.id);

    const [worker, setWorker] = useState(null);
    const [captures, setCaptures] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        setIsLoading(true);
        setError("");
        try {
            const [users, caps] = await Promise.all([
                listUsers(),
                listQueue({ worker_id: id, limit: 500 }),
            ]);
            setWorker((users || []).find((u) => u.id === id) || null);
            setCaptures(Array.isArray(caps) ? caps : []);
        } catch (e) {
            setError(e instanceof CatalyticApiError ? e.message : "Failed to load worker");
        } finally {
            setIsLoading(false);
        }
    }, [id]);

    useEffect(() => {
        load();
    }, [load]);

    const counts = useMemo(() => {
        const c = { total: captures?.length || 0, DRAFT: 0, PENDING_REVIEW: 0, APPROVED: 0, REJECTED: 0 };
        (captures || []).forEach((cap) => { c[cap.status] = (c[cap.status] || 0) + 1; });
        return c;
    }, [captures]);

    if (isLoading) return <div className="flex items-center gap-2 text-white/50 text-sm py-12 justify-center"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;

    return (
        <div className="space-y-5">
            <button type="button" onClick={() => router.push("/cats/admin/workers")} className="inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to workers
            </button>

            {error ? (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium">{error}</div>
            ) : (
                <>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                        <div className="font-bold text-white/90">{worker?.email || `User #${id}`}</div>
                        {worker && (
                            <span className={`mt-1 inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${worker.is_active ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-white/15 bg-white/5 text-white/40"}`}>
                                {worker.is_active ? "Active" : "Inactive"}
                            </span>
                        )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                            { label: "Total", value: counts.total },
                            { label: "Pending", value: counts.PENDING_REVIEW || 0 },
                            { label: "Approved", value: counts.APPROVED || 0 },
                            { label: "Rejected", value: counts.REJECTED || 0 },
                        ].map((s) => (
                            <div key={s.label} className="rounded-xl border border-white/10 bg-black/25 p-3 text-center">
                                <div className="text-xl font-black text-white/90">{s.value}</div>
                                <div className="text-[10px] uppercase tracking-wider text-white/40 font-bold mt-0.5">{s.label}</div>
                            </div>
                        ))}
                    </div>

                    <div>
                        <h2 className="text-xs font-bold uppercase tracking-wider text-white/40 mb-2">Submissions</h2>
                        {!captures?.length ? (
                            <div className="rounded-2xl border border-white/10 bg-black/25 p-6 text-center text-sm text-white/45">No submissions yet.</div>
                        ) : (
                            <div className="space-y-2">
                                {captures.map((c) => (
                                    <Link
                                        key={c.id}
                                        href={`/cats/moderation/${c.id}`}
                                        className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] transition-colors px-4 py-3"
                                    >
                                        <div className="min-w-0">
                                            <div className="text-sm font-bold text-white/85 truncate">
                                                {[c.year, c.make, c.model].filter(Boolean).join(" ") || c.vin || `Capture #${c.id}`}
                                            </div>
                                            <div className="text-[11px] text-white/40 mt-0.5">{fmtDate(c.submitted_at || c.created_at)} · {c.catalysts?.length || 0} catalyst{c.catalysts?.length === 1 ? "" : "s"}</div>
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
    );
}
