"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";

import { getRecoverySummary } from "@/lib/operations/api";
import { CatalyticApiError } from "@/lib/catalytic/http";
import { formatMoney } from "@/lib/operations/format";

// All batches at a glance. The figures are the same ones each batch shows.
export default function RecoveryOverview() {
    const [summary, setSummary] = useState(null);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        try {
            setSummary(await getRecoverySummary());
            setError("");
        } catch (e) {
            setError(e instanceof CatalyticApiError ? e.message : "Failed to load recovery totals");
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    return (
        <section aria-label="Recovery overview" className="rounded-xl border border-white/10 bg-black/25 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                {summary ? (
                    <div className="min-w-0">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-white/40">
                            {summary.rules_active ? "Recovery Total, all batches" : "Known value, all batches"}
                        </div>
                        <div className="text-lg font-black text-emerald-300">{formatMoney(summary.recovery_total)}</div>
                        <div className="text-[11px] text-white/40">
                            {summary.vehicles} vehicles · {summary.complete} complete · {summary.partial} partial · {summary.no_data} no data
                        </div>
                    </div>
                ) : error ? (
                    <span className="flex flex-1 items-center justify-between gap-3 text-xs text-rose-300">
                        {error}
                        <button type="button" onClick={load} className="underline">Retry</button>
                    </span>
                ) : (
                    <span className="text-xs text-white/50">Loading recovery totals…</span>
                )}
                <Link
                    href="/operations/recovery"
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-white/15 px-3 text-xs font-bold text-white/85"
                >
                    <SlidersHorizontal className="h-3.5 w-3.5" /> Recovery Settings
                </Link>
            </div>
        </section>
    );
}
