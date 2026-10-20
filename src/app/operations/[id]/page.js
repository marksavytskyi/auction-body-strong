"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, Boxes, ArrowLeft, RefreshCw, AlertTriangle } from "lucide-react";

import { getOperationsBatch } from "@/lib/operations/api";
import { CatalyticApiError } from "@/lib/catalytic/http";
import { BATCH_STATUS, BATCH_STATUS_TONE } from "@/lib/operations/constants";
import { formatDate } from "@/lib/operations/format";
import StatusPill from "@/components/catalytic/StatusPill";
import ProcessingControls from "@/components/operations/ProcessingControls";
import FinancialSummaryCards from "@/components/operations/FinancialSummaryCards";
import ProcessingProgress from "@/components/operations/ProcessingProgress";
import ExportCsvButton from "@/components/operations/ExportCsvButton";
import CatdbSection from "@/components/operations/CatdbSection";
import VehicleTable from "@/components/operations/VehicleTable";
import VehicleDetailModal from "@/components/operations/VehicleDetailModal";

const POLL_MS = 5000;

export default function OperationsBatchDetailPage() {
    const params = useParams();
    const router = useRouter();
    const batchId = params?.id;

    const [batch, setBatch] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [refreshKey, setRefreshKey] = useState(0);
    const [selectedVehicle, setSelectedVehicle] = useState(null);

    const pollRef = useRef(null);
    const mountedRef = useRef(true);

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

    // Controlled polling: only while the batch is actively PROCESSING,
    // stopped the instant it leaves that state, stopped on unmount, and
    // never more than one request in flight at a time (setTimeout
    // re-armed only after the previous call resolves — never setInterval
    // stacking requests under load).
    useEffect(() => {
        mountedRef.current = true;
        let cancelled = false;

        const tick = async () => {
            const data = await load();
            if (cancelled) return;
            if (data?.status === BATCH_STATUS.PROCESSING) {
                // Refresh financial summary/progress/vehicle table in
                // lockstep with the batch poll itself — one shared cadence,
                // never a second independent timer.
                setRefreshKey((k) => k + 1);
                pollRef.current = setTimeout(tick, POLL_MS);
            }
        };
        tick();

        return () => {
            cancelled = true;
            mountedRef.current = false;
            if (pollRef.current) clearTimeout(pollRef.current);
        };
    }, [load]);

    const handleBatchUpdated = (updated) => {
        setBatch(updated);
        setRefreshKey((k) => k + 1);
        if (updated?.status === BATCH_STATUS.PROCESSING && !pollRef.current) {
            pollRef.current = setTimeout(async function tick() {
                const data = await load();
                if (data?.status === BATCH_STATUS.PROCESSING && mountedRef.current) {
                    setRefreshKey((k) => k + 1);
                    pollRef.current = setTimeout(tick, POLL_MS);
                } else {
                    pollRef.current = null;
                }
            }, POLL_MS);
        }
    };

    const handleManualRefresh = () => {
        load();
        setRefreshKey((k) => k + 1);
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

            <ProcessingControls batch={batch} onBatchUpdated={handleBatchUpdated} />

            <CatdbSection batchId={batch.id} onBatchDataChanged={() => setRefreshKey((k) => k + 1)} />

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
