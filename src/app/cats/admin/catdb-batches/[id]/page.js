"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
    Loader2, ListChecks, ArrowLeft, RefreshCw, PauseCircle, Ban, AlertTriangle,
    ChevronDown, ChevronRight, CircleHelp,
} from "lucide-react";

import { getBatch, pauseBatch, resumeBatch, cancelBatch } from "@/lib/catalytic/catdbBatch";
import { getSnapshot } from "@/lib/catalytic/catdbAdmin";
import { formatCatdbPriceRange } from "@/lib/catalytic/catdbPricing";
import { CatalyticApiError } from "@/lib/catalytic/api";
import { Button } from "@/components/ui/button";
import StatusPill from "@/components/catalytic/StatusPill";
import StartBatchButton from "@/components/catalytic/StartBatchButton";
import { useAdminTierGate } from "@/hooks/useRoleGate";

const POLL_INTERVAL_MS = 4000;

const BATCH_STATUS_TONE = { CREATED: "neutral", RUNNING: "progress", PAUSED: "warning", COMPLETED: "success", CANCELLED: "danger" };

// Item display status — derived from the backend's own CatDBBatchItem
// status plus (for QUEUED items only) the embedded job_status the batch
// API already returns per-item. Never invented beyond what's there.
function itemDisplay(item) {
    if (item.status === "QUEUED") {
        const processing = item.job_status === "LEASED" || item.job_status === "RUNNING";
        return { label: processing ? "PROCESSING" : "QUEUED", tone: processing ? "progress" : "info" };
    }
    if (item.status === "COMPLETED") {
        return item.result_outcome === "SUCCESS_WITH_WARNING"
            ? { label: "COMPLETED (WARNING)", tone: "warning" }
            : { label: "COMPLETED", tone: "success" };
    }
    if (item.status === "NO_RESULT") return { label: "NO RESULT", tone: "neutral" };
    if (item.status === "FAILED") return { label: "FAILED", tone: "danger" };
    if (item.status === "SKIPPED") return { label: "SKIPPED", tone: "neutral" };
    return { label: "WAITING", tone: "neutral" }; // RESERVED
}

function fmtDate(s) {
    if (!s) return "—";
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? s : d.toLocaleString();
}

function SnapshotPanel({ snapshotId }) {
    const [snapshot, setSnapshot] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        getSnapshot(snapshotId)
            .then((s) => { if (!cancelled) setSnapshot(s); })
            .catch((e) => { if (!cancelled) setError(e instanceof CatalyticApiError ? e.message : "Failed to load CatDB result"); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [snapshotId]);

    if (loading) return <div className="flex items-center gap-2 text-white/40 text-xs py-4 justify-center"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading CatDB result…</div>;
    if (error) return <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">{error}</div>;
    if (!snapshot) return null;

    return (
        <div className="space-y-3 p-3 rounded-xl border border-white/10 bg-black/30">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-bold">
                <span className="text-sky-400">CATDB RESULT</span>
                <span className="text-white/30">· {snapshot.result_status}</span>
                <span className="text-white/30">· {snapshot.catalyst_count ?? 0} catalyst{snapshot.catalyst_count === 1 ? "" : "s"}</span>
            </div>

            {snapshot.parse_warning && (
                <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-200 text-[11px]">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {snapshot.parse_warning}
                </div>
            )}

            {snapshot.items?.length > 0 ? (
                <>
                    {/* Desktop/tablet table */}
                    <div className="hidden sm:block overflow-x-auto rounded-lg border border-white/10">
                        <table className="w-full text-[11px]">
                            <thead className="bg-black/40">
                                <tr>
                                    {["Code", "Quantity", "Position", "Label", "Price"].map((h) => (
                                        <th key={h} className="px-2 py-1.5 text-left uppercase tracking-wider text-white/40 font-bold whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {snapshot.items.map((it) => (
                                    <tr key={it.id} className="odd:bg-white/[0.02]">
                                        <td className="px-2 py-1.5 text-white/70 font-mono whitespace-nowrap">{it.catalyst_code || "—"}</td>
                                        {/* quantity is always a real, meaningful integer (default 1) —
                                            never hidden, since one structured row can represent more
                                            than one physical catalyst (see CatDBSnapshotItem docstring). */}
                                        <td className="px-2 py-1.5 text-white/80 font-bold whitespace-nowrap">{it.quantity ?? 1}</td>
                                        <td className="px-2 py-1.5 text-white/60 whitespace-nowrap">{it.position || "—"}</td>
                                        <td className="px-2 py-1.5 text-white/60">{it.catalyst_label || "—"}</td>
                                        <td className="px-2 py-1.5 text-white/90 font-bold whitespace-nowrap">
                                            {formatCatdbPriceRange(it)}
                                            {it.price_warning && (
                                                <span title={it.price_warning} className="inline-block ml-1 text-amber-400"><CircleHelp className="h-3 w-3 inline" /></span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile cards */}
                    <div className="sm:hidden space-y-1.5">
                        {snapshot.items.map((it) => (
                            <div key={it.id} className="rounded-lg border border-white/10 bg-black/25 p-2.5 space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="font-mono text-white/80 text-xs font-bold">{it.catalyst_code || "—"}</span>
                                    <span className="text-[10px] uppercase tracking-wider text-white/40 font-bold">Qty {it.quantity ?? 1}</span>
                                </div>
                                <div className="text-[11px] text-white/60">{it.catalyst_label || "—"}{it.position ? ` · ${it.position}` : ""}</div>
                                <div className="text-sm font-bold text-white/90 flex items-center gap-1.5">
                                    {formatCatdbPriceRange(it)}
                                    {it.price_warning && (
                                        <span title={it.price_warning} className="text-amber-400"><CircleHelp className="h-3.5 w-3.5" /></span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            ) : (
                <div className="text-[11px] text-white/35 italic">No catalyst line items on this snapshot.</div>
            )}
        </div>
    );
}

function ItemRow({ item }) {
    const [expanded, setExpanded] = useState(false);
    const display = itemDisplay(item);
    const vehicleLabel = [item.year, item.make, item.model].filter(Boolean).join(" ") || "Unknown vehicle";
    const canExpand = Boolean(item.latest_snapshot_id);

    return (
        <div className="rounded-xl border border-white/10 bg-black/25 overflow-hidden">
            <div
                className={`flex items-center justify-between gap-3 px-3 py-2.5 ${canExpand ? "cursor-pointer hover:bg-white/[0.03]" : ""}`}
                onClick={() => canExpand && setExpanded((e) => !e)}
            >
                <div className="flex items-center gap-2 min-w-0">
                    {canExpand ? (expanded ? <ChevronDown className="h-3.5 w-3.5 text-white/30 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-white/30 shrink-0" />) : <span className="w-3.5 shrink-0" />}
                    <div className="min-w-0">
                        <div className="text-sm font-bold text-white/85 truncate">{vehicleLabel}</div>
                        <div className="text-[11px] text-white/40 font-mono truncate">{item.vin || "—"} · Lot {item.lot_number || "—"}</div>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {item.stop_detail && (
                        <span title={item.stop_detail} className="text-rose-300/70"><CircleHelp className="h-3.5 w-3.5" /></span>
                    )}
                    <StatusPill label={display.label} tone={display.tone} />
                </div>
            </div>
            {expanded && canExpand && (
                <div className="px-3 pb-3">
                    <SnapshotPanel snapshotId={item.latest_snapshot_id} />
                </div>
            )}
            {item.stop_detail && !canExpand && (
                <div className="px-3 pb-2.5 text-[11px] text-rose-300/80">{item.stop_detail}</div>
            )}
        </div>
    );
}

export default function CatdbBatchDetailPage() {
    const { ready } = useAdminTierGate();
    const params = useParams();
    const router = useRouter();
    const batchId = params?.id;

    const [batch, setBatch] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [actionBusy, setActionBusy] = useState(false);
    const pollRef = useRef(null);

    const load = useCallback(async ({ silent = false } = {}) => {
        if (!silent) setLoading(true);
        try {
            const data = await getBatch(batchId);
            setBatch(data);
            setError("");
        } catch (e) {
            setError(e instanceof CatalyticApiError ? e.message : "Failed to load batch");
        } finally {
            if (!silent) setLoading(false);
        }
    }, [batchId]);

    useEffect(() => {
        if (ready && batchId) load();
    }, [ready, batchId, load]);

    // Conservative polling — only while actively RUNNING, stopped the
    // instant the batch leaves that state (including by a manual
    // pause/cancel elsewhere) so a finished/paused batch never gets
    // hammered with requests.
    useEffect(() => {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        if (batch?.status === "RUNNING") {
            pollRef.current = setInterval(() => load({ silent: true }), POLL_INTERVAL_MS);
        }
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, [batch?.status, load]);

    const runAction = async (fn, successMsg) => {
        setActionBusy(true);
        try {
            await fn();
            toast.success(successMsg);
            await load();
        } catch (e) {
            toast.error(e instanceof CatalyticApiError ? e.message : "Action failed");
        } finally {
            setActionBusy(false);
        }
    };

    if (!ready || loading) {
        return <div className="flex items-center gap-2 text-white/50 text-sm py-16 justify-center"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
    }

    if (error || !batch) {
        return (
            <div className="space-y-4">
                <button onClick={() => router.push("/cats/admin/catdb-batches")} className="text-xs text-white/40 hover:text-white inline-flex items-center gap-1.5"><ArrowLeft className="h-3.5 w-3.5" /> Back to Batches</button>
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium">{error || "Batch not found"}</div>
            </div>
        );
    }

    const stats = batch.stats || {};
    const total = stats.total || 0;
    const settled = (stats.completed || 0) + (stats.no_result || 0) + (stats.failed || 0) + (stats.skipped || 0);
    const isFailFastPause = batch.status === "PAUSED" && Boolean(batch.stopped_reason);

    return (
        <div className="space-y-5">
            <button onClick={() => router.push("/cats/admin/catdb-batches")} className="text-xs text-white/40 hover:text-white inline-flex items-center gap-1.5"><ArrowLeft className="h-3.5 w-3.5" /> Back to Batches</button>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h1 className="text-xl font-black uppercase tracking-tight text-white/90 inline-flex items-center gap-2">
                        <ListChecks className="h-5 w-5 text-sky-400" /> Batch #{batch.id}
                    </h1>
                    <div className="flex items-center gap-2 mt-1.5">
                        <StatusPill label={batch.status} tone={BATCH_STATUS_TONE[batch.status] || "neutral"} />
                        <span className="text-xs text-white/50 font-semibold">{settled} / {total} settled</span>
                        <span className="text-[11px] text-white/30">· Import #{batch.copart_import_id} · created {fmtDate(batch.created_at)}</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button type="button" onClick={() => load()} className="p-2 rounded-xl hover:bg-white/10 text-white/40 hover:text-white" title="Refresh"><RefreshCw className="h-4 w-4" /></button>
                    {batch.status === "CREATED" && <StartBatchButton batchId={batch.id} onStarted={() => load()} />}
                    {batch.status === "RUNNING" && (
                        <Button size="sm" variant="outline" disabled={actionBusy} onClick={() => runAction(() => pauseBatch(batch.id, "paused by admin"), "Batch paused")} className="rounded-xl">
                            <PauseCircle className="h-3.5 w-3.5" /> Pause
                        </Button>
                    )}
                    {batch.status === "PAUSED" && (
                        <Button size="sm" disabled={actionBusy} onClick={() => runAction(() => resumeBatch(batch.id), "Batch resumed")} className="rounded-xl">
                            Resume
                        </Button>
                    )}
                    {(batch.status === "CREATED" || batch.status === "RUNNING" || batch.status === "PAUSED") && (
                        <Button size="sm" variant="outline" disabled={actionBusy} onClick={() => runAction(() => cancelBatch(batch.id, "cancelled by admin"), "Batch cancelled")} className="rounded-xl">
                            <Ban className="h-3.5 w-3.5" /> Cancel
                        </Button>
                    )}
                </div>
            </div>

            {/* Progress bar */}
            <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all ${batch.status === "FAILED" || stats.failed > 0 ? "bg-gradient-to-r from-sky-500 to-rose-500" : "bg-sky-500"}`}
                    style={{ width: total ? `${Math.min(100, (settled / total) * 100)}%` : "0%" }}
                />
            </div>

            {isFailFastPause && (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-4 sm:p-5 flex gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-1.5">
                        <div className="text-sm font-black uppercase tracking-wide text-amber-200">Batch Paused</div>
                        <p className="text-xs text-amber-200/80">Processing stopped before the next VIN to prevent additional CatDB searches.</p>
                        <p className="text-xs text-white/60"><span className="text-white/40">Reason: </span>{batch.stopped_reason}</p>
                        <p className="text-[11px] text-amber-200/50 italic">This will not resume automatically — use Resume above once reviewed, or Cancel to stop here.</p>
                    </div>
                </div>
            )}
            {batch.status === "PAUSED" && !isFailFastPause && (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-white/50">Paused by admin. Resume to continue, or Cancel to stop here.</div>
            )}
            {batch.status === "CANCELLED" && (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-white/50">
                    This batch was cancelled{batch.stopped_reason ? ` — ${batch.stopped_reason}` : ""}. Reserved-but-unsubmitted vehicles were released; any result already captured below is preserved.
                </div>
            )}

            {!batch.items || batch.items.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/25 p-10 text-center text-sm text-white/45">No vehicles in this batch.</div>
            ) : (
                <div className="space-y-2">
                    {batch.items.map((item) => (
                        <ItemRow key={item.id} item={item} />
                    ))}
                </div>
            )}
        </div>
    );
}
