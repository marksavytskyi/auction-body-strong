"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck, Search } from "lucide-react";

import { listQueue } from "@/lib/catalytic/moderation";
import { CatalyticApiError } from "@/lib/catalytic/api";
import { Input } from "@/components/ui/input";
import CaptureStatusBadge from "@/components/catalytic/CaptureStatusBadge";

export default function ModerationQueuePage() {
    const router = useRouter();
    const [search, setSearch] = useState("");
    const [queue, setQueue] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");

    const load = useCallback(async (searchTerm) => {
        setIsLoading(true);
        setError("");
        try {
            const params = { status: "PENDING_REVIEW", limit: 100 };
            if (searchTerm) params.search = searchTerm;
            const data = await listQueue(params);
            setQueue(Array.isArray(data) ? data : []);
        } catch (e) {
            setError(e instanceof CatalyticApiError ? e.message : "Failed to load moderation queue");
            setQueue(null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        load("");
    }, [load]);

    return (
        <div className="space-y-5">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-white/40 font-bold">
                        <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />
                        Moderation Queue
                    </div>
                    <form onSubmit={(e) => { e.preventDefault(); load(search); }} className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search VIN / make / model" className="pl-9 h-10 rounded-xl bg-white/5 border-white/10" />
                    </form>
                </div>
            </div>

            {isLoading ? (
                <div className="flex items-center gap-2 text-white/50 text-sm py-12 justify-center"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
            ) : error ? (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium">{error}</div>
            ) : !queue || queue.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/25 p-8 text-center text-sm text-white/45">Queue is empty.</div>
            ) : (
                <div className="space-y-2">
                    {queue.map((c) => (
                        <button
                            key={c.id}
                            type="button"
                            onClick={() => router.push(`/cats/moderation/${c.id}`)}
                            className="w-full flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] transition-colors px-4 py-3 text-left"
                        >
                            <div className="min-w-0">
                                <div className="text-sm font-bold text-white/90 truncate">
                                    {[c.year, c.make, c.model].filter(Boolean).join(" ") || c.vin || `Capture #${c.id}`}
                                </div>
                                <div className="text-[11px] text-white/40 flex items-center gap-2 mt-0.5">
                                    {c.vin && <span className="font-mono">{c.vin}</span>}
                                    <span>{c.catalysts?.length || 0} catalyst{c.catalysts?.length === 1 ? "" : "s"}</span>
                                    <span>submitted by user #{c.submitted_by_user_id}</span>
                                </div>
                            </div>
                            <CaptureStatusBadge status={c.status} />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
