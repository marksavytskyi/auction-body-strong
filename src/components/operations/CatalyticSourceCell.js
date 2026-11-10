"use client";

import React from "react";

import { formatCatdbPrice, formatDate, formatMoney } from "@/lib/operations/format";

// Phase K.49 — one catalytic source's saved result in its own column. Each reads only
// that source's stored fields: nothing is combined, recalculated or filled in.

const MATCH_LABEL = {
    VIN_EXACT: "Exact VIN",
    YEAR_MAKE_MODEL_ENGINE: "Year, make, model and engine",
    YEAR_MAKE_MODEL: "Year, make and model",
    MAKE_MODEL_ANY_YEAR: "Make and model, any year",
    OWN_SALES: "Our own sales",
    REFERENCE_ESTIMATE: "Reference estimate",
};

const MUTED = "text-white/30";

function State({ text, tone = MUTED }) {
    return <span className={tone}>{text}</span>;
}

// The Our Database, CatDB VIN, CatDB Local and EcoTrade Local results of one vehicle, by source.
export function sourceResults(vehicle) {
    const local = Object.fromEntries((vehicle.catalytic_local || []).map((r) => [r.source, r]));
    return {
        OUR_DATABASE: vehicle,
        CATDB_VIN: vehicle,
        CATDB_LOCAL: local.CATDB_LOCAL || null,
        ECOTRADE_LOCAL: local.ECOTRADE_LOCAL || null,
    };
}

function ourDatabase(v) {
    if (v.ourdb_total_expected != null) {
        const details = [
            "Source: Our Database",
            `Match: ${v.ourdb_is_estimate ? MATCH_LABEL.REFERENCE_ESTIMATE : MATCH_LABEL.OWN_SALES}`,
            v.ourdb_confidence_label && `Confidence: ${v.ourdb_confidence_label}`,
            v.ourdb_total_low != null && v.ourdb_total_high != null && `Range: ${formatMoney(v.ourdb_total_low)}–${formatMoney(v.ourdb_total_high)}`,
        ];
        return {
            node: (
                <>
                    <span>{formatMoney(v.ourdb_total_expected)}</span>
                    {v.ourdb_is_estimate && <div className="text-[10px] font-bold text-amber-300/80">Estimate</div>}
                </>
            ),
            title: details.filter(Boolean).join("\n"),
        };
    }
    switch (v.ourdb_status) {
        case "QUEUED": return { node: <State text="Looking up…" tone="text-sky-300/80" /> };
        case "FAILED": return { node: <State text="Failed" tone="text-rose-300/80" /> };
        case "DONE": return { node: <State text="No match" />, title: "Our Database has no sale for this vehicle" };
        default: return { node: <State text="—" />, title: "Not looked up" };
    }
}

function catdbVin(v) {
    const priced = v.catdb_total_price != null || (v.catdb_price_min != null && v.catdb_price_max != null);
    if (priced) {
        const details = [
            "Source: CatDB VIN Search",
            "Match: Exact VIN",
            v.catdb_catalyst_quantity != null && `Converters: ${v.catdb_catalyst_quantity}`,
            v.catdb_price_warning && `Warning: ${v.catdb_price_warning}`,
        ];
        return {
            node: (
                <>
                    <span>{formatCatdbPrice(v)}</span>
                    {v.catdb_price_warning && <div className="text-[10px] font-bold text-amber-300/80">Check price</div>}
                </>
            ),
            title: details.filter(Boolean).join("\n"),
        };
    }
    switch (v.catdb_status) {
        case "QUEUED":
        case "PROCESSING": return { node: <State text="Searching…" tone="text-sky-300/80" /> };
        case "FAILED": return { node: <State text="Failed" tone="text-rose-300/80" /> };
        case "REVIEW_REQUIRED": return { node: <State text="Review" tone="text-amber-300/80" /> };
        case "NO_RESULT": return { node: <State text="No match" /> };
        case "SKIPPED_INELIGIBLE": return { node: <State text="Not eligible" />, title: "No full VIN to search" };
        default: return { node: <State text="—" />, title: "Not searched" };
    }
}

function local(result, name) {
    if (!result || result.status === "NOT_REQUESTED") return { node: <State text="—" />, title: "Not looked up" };
    if (result.status === "FAILED") return { node: <State text="Failed" tone="text-rose-300/80" />, title: result.searched_at && `Last lookup: ${formatDate(result.searched_at)}` };
    if (result.status === "NO_MATCH" || result.price_expected == null) {
        return { node: <State text="No match" />, title: result.searched_at && `Last lookup: ${formatDate(result.searched_at)}` };
    }
    const details = [
        `Source: ${name}`,
        result.match_type && `Match: ${MATCH_LABEL[result.match_type] || result.match_type}`,
        result.confidence && `Confidence: ${result.confidence}`,
        result.price_low != null && result.price_high != null && `Range: ${formatMoney(result.price_low)}–${formatMoney(result.price_high)}`,
        result.position_count != null && `Positions: ${result.position_count}`,
        result.candidate_count != null && `Converter candidates: ${result.candidate_count}`,
        result.converter_codes?.length > 0 && `Codes: ${result.converter_codes.join(", ")}`,
        result.price_warning && `Warning: ${result.price_warning}`,
        result.searched_at && `Last lookup: ${formatDate(result.searched_at)}`,
    ];
    return {
        node: (
            <>
                <span>{formatMoney(result.price_expected)}</span>
                {result.confidence === "LOW" && <div className="text-[10px] font-bold text-amber-300/80">Low confidence</div>}
            </>
        ),
        title: details.filter(Boolean).join("\n"),
    };
}

export function describeSource(source, vehicle) {
    const results = sourceResults(vehicle);
    if (source === "OUR_DATABASE") return ourDatabase(vehicle);
    if (source === "CATDB_VIN") return catdbVin(vehicle);
    return local(results[source], source === "CATDB_LOCAL" ? "CatDB Local" : "EcoTrade Local");
}

export default function CatalyticSourceCell({ source, vehicle }) {
    const { node, title } = describeSource(source, vehicle);
    return <span title={title || undefined} data-source={source}>{node}</span>;
}
