"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, AlertTriangle, DollarSign } from "lucide-react";
import CollapsibleSection from "./CollapsibleSection";

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
function MoneyCard({ label, value, hint, emphasis, emptyText }) {
    return (
        <div className="rounded-xl border border-white/10 bg-black/25 p-3 sm:p-4">
            <div className="text-[10px] uppercase tracking-wider text-white/40 font-bold mb-1">{label}</div>
            {emptyText ? (
                <div className="text-sm font-bold text-white/50">{emptyText}</div>
            ) : (
                <div className={emphasis ? "text-lg font-black text-emerald-300 sm:text-2xl" : "text-base font-bold text-white/85 sm:text-xl"}>
                    {formatMoney(value)}
                </div>
            )}
            {hint && <div className="mt-1 hidden text-[11px] text-white/35 sm:block">{hint}</div>}
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

// Phase K.52 — the one line shown while the section is closed. Never a $0.00 that
// really means "nothing calculated yet".
export function financialHeadline(summary) {
    if (!summary) return null;
    const hasDual = summary.catdb_recovery_total != null && summary.ourdb_recovery_total != null;
    if (hasDual) return `Recovery Total — CatDB ${formatMoney(summary.catdb_recovery_total)} · Our Database ${formatMoney(summary.ourdb_recovery_total)}`;
    if (summary.rules_active) {
        return summary.known_value_total == null ? "Recovery Total not calculated yet" : `Recovery Total ${formatMoney(summary.known_value_total)}`;
    }
    const complete = (summary.complete_count || 0) + (summary.complete_with_estimates_count || 0);
    if (!complete) return "No complete vehicles yet";
    return `Complete Recovery Total ${formatMoney(summary.complete_recovery_total)} · ${complete} of ${summary.total_vehicle_count} vehicles`;
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

    const rulesStatus = summary ? (summary.rules_active ? { label: "Rules active", tone: "success" } : { label: "Rules not active", tone: "neutral" }) : null;
    const headline = loading ? "Loading…" : error ? null : financialHeadline(summary);
    return (
        <CollapsibleSection title="Financial Summary" icon={DollarSign} summary={headline}
            status={error ? { label: "Couldn't load", tone: "danger" } : rulesStatus}>
            {loading ? (
                <div className="flex items-center gap-2 text-white/50 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading financial summary…</div>
            ) : error ? (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2"><AlertTriangle className="h-4 w-4 shrink-0" /> {error}</span>
                    <button type="button" onClick={load} className="underline shrink-0">Retry</button>
                </div>
            ) : summary ? <SummaryBody summary={summary} /> : null}
        </CollapsibleSection>
    );
}

function SummaryBody({ summary }) {
    // Phase K.10 — present only when the batch has BOTH run_catdb and
    // run_ourdb selected (see app.operations.services.get_batch_financial_summary_dual).
    // Shown INSTEAD of the single Complete Recovery Total card — the two
    // numbers are independent alternatives and must never be added
    // together or displayed as if one "the" total existed.
    const isDualSource = summary.catdb_recovery_total !== null && summary.catdb_recovery_total !== undefined
        && summary.ourdb_recovery_total !== null && summary.ourdb_recovery_total !== undefined;

    const completeVehicles = (summary.complete_count || 0) + (summary.complete_with_estimates_count || 0);
    return (
        <div className="space-y-2 sm:space-y-3">
            {!summary.rules_active && (
                <p className="text-[11px] text-white/45">Recovery Rules aren&apos;t active for this batch, so these are the standard totals. Activate rules in Recovery Settings to use them.</p>
            )}

            <div className="grid grid-cols-2 gap-2 sm:gap-3">
                {isDualSource ? (
                    <>
                        <MoneyCard
                            label="Recovery Total — CatDB"
                            value={summary.catdb_recovery_total}
                            hint="Fully-estimated vehicles using the CatDB catalytic value"
                            emphasis
                        />
                        <MoneyCard
                            label="Recovery Total — Our Database"
                            value={summary.ourdb_recovery_total}
                            hint="Fully-estimated vehicles using the Our Database catalytic value — never added to the CatDB total"
                            emphasis
                        />
                    </>
                ) : summary.rules_active ? (
                    <MoneyCard
                        label="Recovery Total"
                        value={summary.known_value_total}
                        emptyText={summary.known_value_total == null ? "Not calculated yet" : null}
                        hint="Sum of every vehicle's total under the recovery rules"
                        emphasis
                    />
                ) : (
                    <MoneyCard
                        label="Complete Recovery Total"
                        value={summary.complete_recovery_total}
                        hint="Sum of fully-estimated vehicles only (Complete / Complete with Estimates)"
                        emphasis
                        emptyText={completeVehicles === 0 ? "Not calculated: no complete vehicles yet" : null}
                    />
                )}
                <MoneyCard
                    label={summary.rules_active ? "Of which on Incomplete Vehicles" : "Partial Known Components Subtotal"}
                    value={summary.partial_known_components_subtotal}
                    hint="Sum of the known components on Partial vehicles — not a full recovery estimate"
                />
            </div>

            <div className="grid gap-2 grid-cols-2 sm:gap-3 sm:grid-cols-4">
                <MoneyCard label="Engine Total" value={summary.engine_value_total} />
                <MoneyCard label="Transmission Total" value={summary.transmission_value_total} />
                <MoneyCard label="Selected Catalytic Total" value={summary.cats_value_total} />
                <MoneyCard label="Scrap Total" value={summary.scrap_value_total} />
            </div>

            {summary.catdb_range_vehicle_count > 0 && !summary.rules_active && (
                <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.03] p-3 sm:p-4">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-violet-200/70">
                        CatDB Estimates: {summary.catdb_range_vehicle_count} vehicle{summary.catdb_range_vehicle_count === 1 ? "" : "s"} with a price range
                    </div>
                    <p className="mt-1 text-[11px] text-white/40">Estimates from price ranges. Not included in any total above.</p>
                    <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
                        {[["Low", "low"], ["Mid", "mid"], ["High", "high"]].map(([label, key]) => (
                            <div key={key} className="min-w-0">
                                <dt className="text-[10px] uppercase tracking-wider text-white/40">{label}</dt>
                                <dd className="truncate font-bold text-white/85">{formatMoney(summary[`catdb_${key}_total`])}</dd>
                                <dd className="mt-1 truncate text-white/60" title="Known components plus this CatDB figure">{formatMoney(summary[`estimated_recovery_${key}_total`])}</dd>
                            </div>
                        ))}
                    </dl>
                    <p className="mt-1 text-[11px] text-white/35">Top: catalytic only. Bottom: with known engine, transmission and Scrap values.</p>
                </div>
            )}

            <div className="rounded-xl border border-white/10 bg-black/25 p-3 sm:p-4">
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
