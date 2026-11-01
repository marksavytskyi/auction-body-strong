"use client";

import React, { useEffect, useState } from "react";

import { getOperationsVehicleCatalytic } from "@/lib/operations/api";
import { CatalyticApiError } from "@/lib/catalytic/http";
import { formatDate, formatMoney } from "@/lib/operations/format";
import { CATALYTIC_SOURCE_LABEL, CATALYTIC_STATUS_LABEL, CATALYTIC_STATUS_TONE } from "@/lib/operations/constants";
import StatusPill from "@/components/catalytic/StatusPill";

function priceText(result) {
    const { price_low: low, price_high: high } = result;
    if (low != null && high != null) return Number(low) === Number(high) ? formatMoney(low) : `${formatMoney(low)}–${formatMoney(high)}`;
    return formatMoney(result.price_expected);
}

// One block per source, exactly as stored. Nothing here merges or picks between them.
export default function VehicleCatalyticResults({ batchId, vehicleId }) {
    const [results, setResults] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        let current = true;
        getOperationsVehicleCatalytic(batchId, vehicleId)
            .then((data) => { if (current) setResults(data.results); })
            .catch((e) => { if (current) setError(e instanceof CatalyticApiError ? e.message : "Failed to load catalytic results"); });
        return () => { current = false; };
    }, [batchId, vehicleId]);

    return (
        <div className="mb-4 rounded-xl border border-white/10 bg-black/25 p-4">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-white/40">Catalytic Results by Source</div>
            {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
            {!results && !error && <p className="text-xs text-white/40">Loading…</p>}
            <div className="space-y-3">
                {results?.map((result) => (
                    <div key={result.source} className="border-t border-white/5 pt-2 first:border-t-0 first:pt-0">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-bold text-white/85">{CATALYTIC_SOURCE_LABEL[result.source]}</span>
                            <StatusPill label={CATALYTIC_STATUS_LABEL[result.status] || result.status} tone={CATALYTIC_STATUS_TONE[result.status] || "neutral"} />
                        </div>
                        {(result.price_low != null || result.price_high != null || result.price_expected != null) && (
                            <div className="mt-1 text-sm font-bold text-white/90">
                                {priceText(result)} <span className="text-[10px] font-normal text-white/35">estimate</span>
                            </div>
                        )}
                        {result.price_expected != null && (
                            <div className="text-[11px] text-white/45">Expected {formatMoney(result.price_expected)}</div>
                        )}
                        {result.match_type && (
                            <div className="text-[11px] text-white/45">
                                Match: {result.match_type.replaceAll("_", " ").toLowerCase()}
                                {result.confidence && ` · ${result.confidence.toLowerCase()} confidence`}
                                {result.source_updated_at && ` · data from ${formatDate(result.source_updated_at)}`}
                            </div>
                        )}
                        {result.matched_record && (
                            <details className="mt-1 text-[11px] text-white/45">
                                <summary className="cursor-pointer">Matched record</summary>
                                {result.matched_record.top_candidates?.length > 0 && (
                                    <ul className="mt-1 space-y-0.5">
                                        {result.matched_record.top_candidates.map((c) => (
                                            <li key={c.code} className="flex flex-wrap justify-between gap-2">
                                                <span className="font-mono">{c.code}</span>
                                                <span>{formatMoney(c.price_avg)} · {Math.round(c.probability * 100)}%</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                {result.matched_record.candidate_count != null && (
                                    <div className="mt-1">{result.matched_record.candidate_count} converters listed across {result.matched_record.vehicle_key_count} catalog entries</div>
                                )}
                                {result.matched_record.snapshot_id != null && <div className="mt-1">Stored search #{result.matched_record.snapshot_id}</div>}
                                {result.matched_record.job_id != null && result.matched_record.snapshot_id == null && <div className="mt-1">CatDB job #{result.matched_record.job_id}</div>}
                                {result.matched_record.error && <div className="mt-1 text-rose-300">{result.matched_record.error}</div>}
                            </details>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
