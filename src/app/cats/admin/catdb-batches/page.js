"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Loader2 as Spinner, ListChecks as ListChecksIcon, RefreshCw as RefreshIcon, PauseCircle as PauseIcon, Ban as BanIcon, Eye as EyeIcon } from "lucide-react";

import { listBatches, pauseBatch, resumeBatch, cancelBatch } from "@/lib/catalytic/catdbBatch";
import { CatalyticApiError } from "@/lib/catalytic/api";
import { Button } from "@/components/ui/button";
import StatusPill from "@/components/catalytic/StatusPill";
import StartBatchButton from "@/components/catalytic/StartBatchButton";
import { useAdminTierGate } from "@/hooks/useRoleGate";

const STATUS_TONE = {
    CREATED: "neutral",
    RUNNING: "progress",
    PAUSED: "warning",
    COMPLETED: "success",
    CANCELLED: "danger",
};

function fmtDate(s) {
    if (!s) return "—";
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? s : d.toLocaleString();
}

function BatchRow({ batch, onChanged }) {
    const [busy, setBusy] = useState(false);
    const stats = batch.stats || {};
    const total = stats.total || 0;
    const done = (stats.completed || 0) + (stats.no_result || 0) + (stats.failed || 0) + (stats.skipped || 0);

    const run = async (fn, successMsg) => {
        setBusy(true);
        try {
            await fn();
            toast.success(successMsg);
            onChanged();
        } catch (e) {
            toast.error(e instanceof CatalyticApiError ? e.message : "Action failed");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <Link href={`/cats/admin/catdb-batches/${batch.id}`} className="min-w-0 group">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white/90 group-hover:text-sky-300">Batch #{batch.id}</span>
                    <StatusPill label={batch.status} tone={STATUS_TONE[batch.status] || "neutral"} />
                </div>
                <div className="text-[11px] text-white/40 mt-0.5">
                    Import #{batch.copart_import_id} · {fmtDate(batch.created_at)} · <span className="text-white/60 font-semibold">{done} / {total}</span> settled
                    {stats.failed > 0 && <span className="text-rose-300"> · {stats.failed} failed</span>}
                    {stats.no_result > 0 && <span className="text-white/40"> · {stats.no_result} no result</span>}
                </div>
            </Link>

            <div className="flex items-center gap-2 shrink-0">
                {batch.status === "CREATED" && (
                    <>
                        <StartBatchButton batchId={batch.id} onStarted={onChanged} />
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => cancelBatch(batch.id), "Batch cancelled")} className="rounded-xl">
                            <BanIcon className="h-3.5 w-3.5" /> Cancel
                        </Button>
                    </>
                )}
                {batch.status === "RUNNING" && (
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => pauseBatch(batch.id, "paused by admin"), "Batch paused")} className="rounded-xl">
                        <PauseIcon className="h-3.5 w-3.5" /> Pause
                    </Button>
                )}
                {batch.status === "PAUSED" && (
                    <>
                        <Button size="sm" disabled={busy} onClick={() => run(() => resumeBatch(batch.id), "Batch resumed")} className="rounded-xl">
                            Resume
                        </Button>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => cancelBatch(batch.id), "Batch cancelled")} className="rounded-xl">
                            <BanIcon className="h-3.5 w-3.5" /> Cancel
                        </Button>
                    </>
                )}
                {(batch.status === "COMPLETED" || batch.status === "CANCELLED") && (
                    <Link href={`/cats/admin/catdb-batches/${batch.id}`}>
                        <Button size="sm" variant="outline" className="rounded-xl"><EyeIcon className="h-3.5 w-3.5" /> {batch.status === "COMPLETED" ? "View Results" : "View"}</Button>
                    </Link>
                )}
            </div>
        </div>
    );
}

export default function CatdbBatchesPage() {
    const { ready } = useAdminTierGate();
    const [batches, setBatches] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const data = await listBatches();
            setBatches(Array.isArray(data) ? data : []);
        } catch (e) {
            setError(e instanceof CatalyticApiError ? e.message : "Failed to load CatDB batches");
            setBatches(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (ready) load();
    }, [ready, load]);

    if (!ready) {
        return <div className="flex items-center justify-center py-16 text-white/40 text-sm uppercase tracking-wider">Loading…</div>;
    }

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-black uppercase tracking-tight text-white/90 inline-flex items-center gap-2">
                        <ListChecksIcon className="h-5 w-5 text-sky-400" /> CatDB Batches
                    </h1>
                    <p className="text-xs text-white/40 mt-1">Sequential CatDB VIN processing — one search at a time, fail-fast by default.</p>
                </div>
                <button type="button" onClick={load} className="p-2 rounded-xl hover:bg-white/10 text-white/40 hover:text-white" title="Refresh"><RefreshIcon className="h-4 w-4" /></button>
            </div>

            {loading ? (
                <div className="flex items-center gap-2 text-white/50 text-sm py-12 justify-center"><Spinner className="h-4 w-4 animate-spin" /> Loading…</div>
            ) : error ? (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium">{error}</div>
            ) : !batches || batches.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/25 p-10 text-center">
                    <ListChecksIcon className="h-8 w-8 text-white/20 mx-auto mb-3" />
                    <div className="text-sm text-white/50 font-medium">No CatDB batches yet.</div>
                    <div className="text-xs text-white/35 mt-1">Create one from a Copart import.</div>
                </div>
            ) : (
                <div className="space-y-2">
                    {batches.map((b) => (
                        <BatchRow key={b.id} batch={b} onChanged={load} />
                    ))}
                </div>
            )}
        </div>
    );
}
