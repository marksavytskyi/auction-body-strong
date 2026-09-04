"use client";

import React from "react";

function fmt(n, currency) {
    if (n === null || n === undefined || !Number.isFinite(Number(n))) return "—";
    try {
        return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD", maximumFractionDigits: 0 }).format(n);
    } catch {
        return `$${Math.round(n)}`;
    }
}

export default function PriceRange({ pricing, size = "md" }) {
    if (!pricing) {
        return <span className="text-white/30 text-xs italic">No pricing data</span>;
    }

    const { low, expected, high, currency } = pricing;
    const textSize = size === "lg" ? "text-lg" : size === "sm" ? "text-xs" : "text-sm";

    return (
        <div className={`flex items-baseline gap-1.5 font-bold ${textSize}`}>
            {low !== null && (
                <>
                    <span className="text-white/45 font-medium">{fmt(low, currency)}</span>
                    <span className="text-white/20">—</span>
                </>
            )}
            <span className="text-emerald-400">{fmt(expected, currency)}</span>
            {high !== null && (
                <>
                    <span className="text-white/20">—</span>
                    <span className="text-white/45 font-medium">{fmt(high, currency)}</span>
                </>
            )}
        </div>
    );
}
