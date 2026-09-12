"use client";

import React from "react";
import { ShieldCheck, FlaskConical } from "lucide-react";
import { countObservedEvidence } from "@/lib/catalytic/normalize";
import { ConfidenceBadge } from "./badges";
import PriceRange from "./PriceRange";

// "Our Database" is our own proprietary pricing — never blended with
// CatDB. Labels are deliberately explicit (OUR EXPECTED / OUR RANGE /
// OUR CONFIDENCE) rather than a bare "estimated price" that could be
// mistaken for someone else's estimate.
export default function OurDbCard({ result }) {
    const observedEvidence = countObservedEvidence(result);
    const hasEvidence = observedEvidence > 0;

    return (
        <div className="rounded-3xl border border-emerald-500/15 bg-emerald-500/[0.03] backdrop-blur-xl overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-white/70">
                    <FlaskConical className="h-4 w-4 text-emerald-400" />
                    Our Database
                </div>
                <ConfidenceBadge confidence={result.confidence} />
            </div>

            <div className="p-5 flex-1 flex flex-col justify-center space-y-3">
                <div className="flex items-baseline justify-between">
                    <span className="text-xs uppercase tracking-wider text-white/40 font-bold">Our Expected</span>
                    <span className="text-2xl font-black text-emerald-400">
                        {result.totalPricing?.expected !== null && result.totalPricing?.expected !== undefined
                            ? new Intl.NumberFormat("en-US", { style: "currency", currency: result.totalPricing.currency || "USD", maximumFractionDigits: 0 }).format(result.totalPricing.expected)
                            : "—"}
                    </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                    <span className="text-white/40 font-bold uppercase tracking-wider">Our Range</span>
                    <PriceRange pricing={result.totalPricing} size="sm" />
                </div>

                <div className="flex items-center justify-between text-xs text-white/50 pt-1 border-t border-white/5">
                    <span>{result.catalystCount ?? "—"} catalyst{result.catalystCount === 1 ? "" : "s"}</span>
                    {hasEvidence ? (
                        <span className="inline-flex items-center gap-1 text-emerald-300/80 font-medium">
                            <ShieldCheck className="h-3 w-3" />
                            {observedEvidence} internal observation{observedEvidence === 1 ? "" : "s"}
                        </span>
                    ) : (
                        <span className="text-white/35 italic">Reference estimate only</span>
                    )}
                </div>
            </div>
        </div>
    );
}
