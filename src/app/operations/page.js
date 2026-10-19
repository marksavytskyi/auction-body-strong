"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Boxes, ArrowRight, RefreshCw, AlertTriangle } from "lucide-react";

import { listOperationsBatches } from "@/lib/operations/api";
import { CatalyticApiError } from "@/lib/catalytic/http";
import { BATCH_STATUS_TONE } from "@/lib/operations/constants";
import { formatDate } from "@/lib/operations/format";
import StatusPill from "@/components/catalytic/StatusPill";
import UploadBatchFlow from "@/components/operations/UploadBatchFlow";

function BatchRow({ batch }) {
    return (
        <Link
            href={`/operations/${batch.id}`}
            className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3.5 hover:bg-white/[0.05] hover:border-white/20 transition-all sm:flex-row sm:items-center sm:justify-between"
        >
            <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 shrink-0">
                    <Boxes className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="min-w-0">
                    <div className="text-sm font-bold text-white/90 truncate">Batch #{batch.id}</div>
                    <div className="text-[11px] text-white/40">{formatDate(batch.created_at)} · {batch.created_by_email}</div>
                </div>
            </div>

            <div className="flex items-center gap-4 flex-wrap text-xs">
                <StatusPill label={batch.status} tone={BATCH_STATUS_TONE[batch.status] || "neutral"} />
                <span className="text-white/60"><b className="text-white/90">{batch.total_vehicles ?? 0}</b> vehicles</span>
                {batch.parts_job_status && (
                    <span className="text-white/40">Parts: {batch.parts_job_status}</span>
                )}
                <ArrowRight className="h-3.5 w-3.5 text-white/30" />
            </div>
        </Link>
    );
}

export default function OperationsOverviewPage() {
    const router = useRouter();
    const [batches, setBatches] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const data = await listOperationsBatches({ limit: 50, offset: 0 });
            setBatches(Array.isArray(data?.items) ? data.items : []);
        } catch (e) {
            setError(e instanceof CatalyticApiError ? e.message : "Failed to load Operations batches");
            setBatches(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    return (
        <div className="space-y-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-xl font-black uppercase tracking-tight text-white/90 inline-flex items-center gap-2">
                        <Boxes className="h-5 w-5 text-emerald-400" /> Operations
                    </h1>
                    <p className="text-xs text-white/40 mt-1">Upload a Copart CSV to create a batch, then run vehicle analysis.</p>
                </div>
                <button type="button" onClick={load} className="p-2 rounded-xl hover:bg-white/10 text-white/40 hover:text-white self-start" title="Refresh">
                    <RefreshCw className="h-4 w-4" />
                </button>
            </div>

            <UploadBatchFlow onUploaded={(batch) => router.push(`/operations/${batch.id}`)} />

            {loading ? (
                <div className="flex items-center gap-2 text-white/50 text-sm py-12 justify-center">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </div>
            ) : error ? (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2"><AlertTriangle className="h-4 w-4 shrink-0" /> {error}</span>
                    <button type="button" onClick={load} className="underline shrink-0">Retry</button>
                </div>
            ) : !batches || batches.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/25 p-10 text-center">
                    <Boxes className="h-8 w-8 text-white/20 mx-auto mb-3" />
                    <div className="text-sm text-white/50 font-medium">No Operations batches yet.</div>
                    <div className="text-xs text-white/35 mt-1">Upload a Copart CSV above to get started.</div>
                </div>
            ) : (
                <div className="space-y-2">
                    {batches.map((b) => (
                        <BatchRow key={b.id} batch={b} />
                    ))}
                </div>
            )}
        </div>
    );
}
