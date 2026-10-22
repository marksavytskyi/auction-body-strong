"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Loader2, Boxes, ArrowLeft, RefreshCw, AlertTriangle } from "lucide-react";

import { getOperationsBatch, getOperationsBatchProgress } from "@/lib/operations/api";
import { CatalyticApiError } from "@/lib/catalytic/http";
import { BATCH_STATUS_TONE, PROGRESS_LEG_LABEL } from "@/lib/operations/constants";
import { formatDate, isLegActive } from "@/lib/operations/format";
import StatusPill from "@/components/catalytic/StatusPill";
import ProcessingControls from "@/components/operations/ProcessingControls";
import FinancialSummaryCards from "@/components/operations/FinancialSummaryCards";
import ProcessingProgress from "@/components/operations/ProcessingProgress";
import ExportCsvButton from "@/components/operations/ExportCsvButton";
import CatdbSection from "@/components/operations/CatdbSection";
import VehicleTable from "@/components/operations/VehicleTable";
import VehicleDetailModal from "@/components/operations/VehicleDetailModal";

const POLL_MS = 4000;
const EMPTY_LEG_ACTIVE = { parts: false, ourdb: false, weight: false };

export default function OperationsBatchDetailPage() {
    const params = useParams();
    const router = useRouter();
    const batchId = params?.id;

    const [batch, setBatch] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [refreshKey, setRefreshKey] = useState(0);
    const [selectedVehicle, setSelectedVehicle] = useState(null);

    // pollRef holds the pending setTimeout handle; pollingRef is the
    // single source of truth for "is a poll chain currently running" —
    // every entry point (mount, a Start click, manual refresh) goes
    // through ensurePolling(), which is a no-op if pollingRef is already
    // true, so this page can never end up with two concurrent timer
    // chains racing each other.
    const pollRef = useRef(null);
    const pollingRef = useRef(false);
    const mountedRef = useRef(true);
    const legActiveRef = useRef(EMPTY_LEG_ACTIVE);

    const load = useCallback(async () => {
        try {
            const data = await getOperationsBatch(batchId);
            if (!mountedRef.current) return data;
            setBatch(data);
            setError("");
            return data;
        } catch (e) {
            if (!mountedRef.current) return null;
            setError(e instanceof CatalyticApiError ? e.message : "Failed to load batch");
            return null;
        } finally {
            if (mountedRef.current) setLoading(false);
        }
    }, [batchId]);

    // Single shared poll tick: fetches the batch AND its real per-leg
    // progress together, then ALWAYS bumps refreshKey — including on the
    // very tick that discovers a leg just finished. That "always" is the
    // actual fix: the previous version only bumped refreshKey while a
    // leg was STILL processing, so the tick that detected completion
    // updated `batch` but never told ProcessingProgress/FinancialSummary
    // Cards/VehicleTable to refetch — only a full page reload (a fresh
    // mount) ever showed the finished result.
    //
    // Whether to schedule another tick is decided from the real per-leg
    // progress counts (isLegActive), never from OperationsBatch.status —
    // that field only ever reflects Parts (see app/operations/parts.py);
    // OurDB and Weight each run and finish independently without ever
    // touching it, so a status-only check could never have polled for
    // them in the first place, regardless of this bug.
    const tick = useCallback(async () => {
        const [batchData, progressData] = await Promise.all([
            load(),
            getOperationsBatchProgress(batchId).catch(() => null),
        ]);
        if (!mountedRef.current) { pollingRef.current = false; return; }

        setRefreshKey((k) => k + 1);

        const nowActive = {
            parts: isLegActive(progressData?.parts),
            ourdb: isLegActive(progressData?.ourdb),
            weight: isLegActive(progressData?.weight),
        };
        for (const legKey of Object.keys(nowActive)) {
            if (legActiveRef.current[legKey] && !nowActive[legKey]) {
                const leg = progressData?.[legKey];
                const legLabel = PROGRESS_LEG_LABEL[legKey] || legKey;
                const failedCount = leg?.failed_count || 0;
                if (failedCount > 0) {
                    toast.error(`${legLabel} analysis finished — ${failedCount} vehicle(s) failed`);
                } else {
                    toast.success(`${legLabel} analysis completed — ${leg?.done_count ?? leg?.total ?? 0} vehicles processed`);
                }
            }
        }
        legActiveRef.current = nowActive;

        if ((nowActive.parts || nowActive.ourdb || nowActive.weight) && mountedRef.current) {
            pollRef.current = setTimeout(tick, POLL_MS);
        } else {
            pollRef.current = null;
            pollingRef.current = false;
        }
        return batchData;
    }, [batchId, load]);

    const ensurePolling = useCallback(() => {
        if (pollingRef.current) return;
        pollingRef.current = true;
        tick();
    }, [tick]);

    useEffect(() => {
        mountedRef.current = true;
        ensurePolling();
        return () => {
            mountedRef.current = false;
            pollingRef.current = false;
            if (pollRef.current) clearTimeout(pollRef.current);
        };
    }, [ensurePolling]);

    // Called with the batch the /parts|ourdb|weight/start endpoint just
    // returned, and which leg was started. Marking that leg active in
    // legActiveRef BEFORE the next tick runs is what lets a genuinely
    // fast backend completion (done before the first poll even fires)
    // still show its completion notification, instead of looking like it
    // was "always done" and never actually transitioned.
    const handleBatchUpdated = (updated, startedLeg) => {
        setBatch(updated);
        if (startedLeg) legActiveRef.current = { ...legActiveRef.current, [startedLeg]: true };
        setRefreshKey((k) => k + 1);
        ensurePolling();
    };

    const handleManualRefresh = () => {
        load();
        setRefreshKey((k) => k + 1);
        ensurePolling();
    };

    if (loading) {
        return <div className="flex items-center gap-2 text-white/50 text-sm py-16 justify-center"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
    }

    if (error || !batch) {
        return (
            <div className="space-y-4">
                <button onClick={() => router.push("/operations")} className="text-xs text-white/40 hover:text-white inline-flex items-center gap-1.5"><ArrowLeft className="h-3.5 w-3.5" /> Back to Operations</button>
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2"><AlertTriangle className="h-4 w-4 shrink-0" /> {error || "Batch not found"}</span>
                    <button type="button" onClick={handleManualRefresh} className="underline shrink-0">Retry</button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <button onClick={() => router.push("/operations")} className="text-xs text-white/40 hover:text-white inline-flex items-center gap-1.5"><ArrowLeft className="h-3.5 w-3.5" /> Back to Operations</button>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h1 className="text-xl font-black uppercase tracking-tight text-white/90 inline-flex items-center gap-2">
                        <Boxes className="h-5 w-5 text-emerald-400" /> Batch #{batch.id}
                    </h1>
                    <p className="text-xs text-white/40 mt-1 inline-flex items-center gap-2">
                        {formatDate(batch.created_at)} · {batch.total_vehicles ?? 0} vehicles · <StatusPill label={batch.status} tone={BATCH_STATUS_TONE[batch.status] || "neutral"} />
                    </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <ExportCsvButton batchId={batch.id} />
                    <button type="button" onClick={handleManualRefresh} className="p-2 rounded-xl hover:bg-white/10 text-white/40 hover:text-white" title="Refresh">
                        <RefreshCw className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {batch.error_message && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">{batch.error_message}</div>
            )}

            <FinancialSummaryCards batchId={batch.id} refreshKey={refreshKey} />

            <ProcessingProgress batchId={batch.id} refreshKey={refreshKey} />

            <ProcessingControls batch={batch} refreshKey={refreshKey} onBatchUpdated={handleBatchUpdated} />

            <CatdbSection batchId={batch.id} refreshKey={refreshKey} onBatchDataChanged={() => setRefreshKey((k) => k + 1)} />

            <div>
                <h2 className="text-sm font-bold text-white/70 uppercase tracking-wide mb-3">Vehicles</h2>
                <VehicleTable batchId={batch.id} onOpenVehicle={setSelectedVehicle} refreshKey={refreshKey} />
            </div>

            {selectedVehicle && (
                <VehicleDetailModal
                    vehicle={selectedVehicle}
                    onClose={() => setSelectedVehicle(null)}
                    onUpdated={(updated) => {
                        setSelectedVehicle(updated);
                        setRefreshKey((k) => k + 1);
                    }}
                />
            )}
        </div>
    );
}
