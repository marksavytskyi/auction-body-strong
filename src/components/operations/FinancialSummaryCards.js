"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, AlertTriangle, DollarSign } from "lucide-react";

import { getOperationsBatchFinancialSummary } from "@/lib/operations/api";
import { CatalyticApiError } from "@/lib/catalytic/http";
import { formatMoney } from "@/lib/operations/format";

// Every dollar figure here comes straight from
// GET /batches/{id}/financial-summary (app.operations.services.get_batch_financial_summary) —
// this component never sums, averages, or otherwise recomputes a
// financial fact client-side. null stays "—" (formatMoney's own rule);
// it is never coerced to 0.
//
// Complete Recovery Total and Partial Known Components Subtotal are
// rendered as two separate cards and are never added together into a
// single "batch value" figure — they are different financial
// categories (COMPLETE/COMPLETE_WITH_ESTIMATES vehicles vs PARTIAL
// vehicles) and combining them would misrepresent what portion of the
// batch is actually a complete estimate.
function MoneyCard({ label, value, hint, emphasis }) {
    return (
        <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
            <div className="text-[10px] uppercase tracking-wider text-white/40 font-bold mb-1.5">{label}</div>
            <div className={emphasis ? "text-2xl font-black text-emerald-300" : "text-xl font-bold text-white/85"}>
                {formatMoney(value)}
            </div>
            {hint && <div className="text-[11px] text-white/35 mt-1">{hint}</div>}
        </div>
    );
}

function CountCell({ label, value, tone }) {
    const toneClass = {
        neutral: "text-white/70",
        success: "text-emerald-300",
        info: "text-sky-300",
        warning: "text-amber-300",
        danger: "text-rose-300",
    }[tone || "neutral"];
    return (
        <div className="text-center">
            <div className={`text-lg font-black ${toneClass}`}>{value ?? 0}</div>
            <div className="text-[9px] uppercase tracking-wider text-white/40 font-bold mt-0.5">{label}</div>
        </div>
    );
}

export default function FinancialSummaryCards({ batchId, refreshKey }) {
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        try {
            const data = await getOperationsBatchFinancialSummary(batchId);
            setSummary(data);
            setError("");
        } catch (e) {
            setError(e instanceof CatalyticApiError ? e.message : "Failed to load financial summary");
        } finally {
            setLoading(false);
        }
    }, [batchId]);

    useEffect(() => { load(); }, [load, refreshKey]);

    if (loading) {
        return (
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4 flex items-center gap-2 text-white/50 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading financial summary…
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2"><AlertTriangle className="h-4 w-4 shrink-0" /> {error}</span>
                <button type="button" onClick={load} className="underline shrink-0">Retry</button>
            </div>
        );
    }

    if (!summary) return null;

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/40 font-bold">
                <DollarSign className="h-3 w-3" /> Financial Summary
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
                <MoneyCard
                    label="Complete Recovery Total"
                    value={summary.complete_recovery_total}
                    hint="Sum of fully-estimated vehicles only (Complete / Complete with Estimates)"
                    emphasis
                />
                <MoneyCard
                    label="Partial Known Components Subtotal"
                    value={summary.partial_known_components_subtotal}
                    hint="Sum of the known components on Partial vehicles — not a full recovery estimate"
                />
            </div>

            <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                <MoneyCard label="Engine Total" value={summary.engine_value_total} />
                <MoneyCard label="Transmission Total" value={summary.transmission_value_total} />
                <MoneyCard label="Selected Catalytic Total" value={summary.cats_value_total} />
                <MoneyCard label="Scrap Total" value={summary.scrap_value_total} />
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <div className="grid grid-cols-5 gap-2">
                    <CountCell label="Total Vehicles" value={summary.total_vehicle_count} />
                    <CountCell label="Complete" value={summary.complete_count} tone="success" />
                    <CountCell label="Complete (Est. Cats)" value={summary.complete_with_estimates_count} tone="info" />
                    <CountCell label="Partial" value={summary.partial_count} tone="warning" />
                    <CountCell label="No Data" value={summary.no_data_count} tone="neutral" />
                </div>
            </div>
        </div>
    );
}
