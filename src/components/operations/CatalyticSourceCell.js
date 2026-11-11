"use client";

import React from "react";

import { formatCatdbPrice, formatDate, formatMoney } from "@/lib/operations/format";
import CellStatus, { LatestAttempt, legState } from "./CellStatus";

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

// Phase K.53: states use CellStatus, so a spinner appears only for work really running.
const leaseActive = (until) => Boolean(until) && new Date(`${until}`.endsWith("Z") ? until : `${until}Z`).getTime() > Date.now();

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
        const latest = v.ourdb_status === "DONE" ? null : legState(v.ourdb_status, { leaseActive: leaseActive(v.ourdb_lease_expires_at) });
        return {
            node: (
                <>
                    <span>{formatMoney(v.ourdb_total_expected)}</span>
                    {v.ourdb_is_estimate && <div className="text-[10px] font-bold text-amber-300/80">Estimate</div>}
                    <LatestAttempt state={latest} detail="the stored price stays until a new one is found" />
                </>
            ),
            title: details.filter(Boolean).join("\n"),
        };
    }
    const state = legState(v.ourdb_status, { doneWithoutValue: "NO_MATCH", leaseActive: leaseActive(v.ourdb_lease_expires_at) });
    return { node: <CellStatus state={state} detail={state === "NO_MATCH" ? "Our Database has no sale for this vehicle" : undefined} /> };
}

// K.56 — CatDB's own "No cat on vehicle!" answer: a finished search, no converter, $0.
export function isCatdbNoCat(v) {
    return v.catdb_status === "DONE" && v.catdb_catalyst_quantity != null && Number(v.catdb_catalyst_quantity) === 0
        && v.catdb_price_max != null && Number(v.catdb_price_max) === 0;
}

function catdbVin(v) {
    const priced = v.catdb_total_price != null || (v.catdb_price_min != null && v.catdb_price_max != null);
    const warning = v.catdb_price_warning;
    // K.56: a total from only some converters is labelled as such, never as the whole answer.
    const partial = Boolean(warning) && warning.includes("PRICE_PARTIAL");
    if (priced && isCatdbNoCat(v)) {
        return {
            node: <span>No cat</span>,
            title: "Source: CatDB VIN Search\nMatch: Exact VIN\nCatDB: no catalytic converter on this vehicle (\u201cNo cat on vehicle!\u201d, $0)",
        };
    }
    if (priced) {
        const details = [
            "Source: CatDB VIN Search",
            "Match: Exact VIN",
            v.catdb_catalyst_quantity != null && `Converters: ${v.catdb_catalyst_quantity}`,
            partial && "Price covers only some converters: not used automatically in the estimate",
            warning && `Warning: ${warning}`,
        ];
        return {
            node: (
                <>
                    <span>{formatCatdbPrice(v)}</span>
                    {warning && <div className="text-[10px] font-bold text-amber-300/80">{partial ? "Partial price" : "Check price"}</div>}
                    <LatestAttempt state={CATDB_STATE[v.catdb_status]} detail={CATDB_DETAIL[v.catdb_status]} />
                </>
            ),
            title: details.filter(Boolean).join("\n"),
        };
    }
    // K.56: CatDB answered but the result couldn't be read — not "No data".
    if (v.catdb_status === "DONE" && warning) {
        return { node: <CellStatus state="REVIEW" detail={`CatDB answered, but its result couldn't be fully read: ${warning}`} /> };
    }
    // K.53 follow-up: the backend says what an active job is really doing, so a job whose device
    // stopped reporting is never shown as running.
    const live = { PAUSED: "PAUSED", WAITING_FOR_DEVICE: "WAITING_FOR_DEVICE", STALE: "STALE", QUEUED: "QUEUED", RUNNING: "RUNNING" }[v.catdb_queue_state];
    const state = live || CATDB_STATE[v.catdb_status] || (v.catdb_status === "DONE" ? "NO_DATA" : "NOT_REQUESTED");
    const job = v.catdb_job_id ? ` (CatDB job #${v.catdb_job_id}; details in CATS → CatDB Automation)` : "";
    const detail = LIVE_DETAIL[v.catdb_queue_state] || CATDB_DETAIL[v.catdb_status] || "";
    return { node: <CellStatus state={state} detail={`${detail}${job}`.trim() || undefined} /> };
}

// CatDB VIN's own states. A timeout is "Requires review", never "No match": the search was
// submitted and its outcome is unknown.
const CATDB_STATE = { QUEUED: "QUEUED", PROCESSING: "RUNNING", FAILED: "FAILED", REVIEW_REQUIRED: "REVIEW", NO_RESULT: "NO_MATCH", SKIPPED_INELIGIBLE: "NOT_ELIGIBLE" };
const LIVE_DETAIL = {
    PAUSED: "nothing runs until CatDB is resumed",
    WAITING_FOR_DEVICE: "no CatDB device is available to pick it up",
    STALE: "no search was recorded; it goes back to the queue, or to review if a search was submitted, when a device next checks in",
};
const CATDB_DETAIL = {
    QUEUED: "waiting for the CatDB device",
    PROCESSING: "the CatDB device is searching this VIN",
    FAILED: "the search failed before a result",
    REVIEW_REQUIRED: "a search was submitted but its outcome is unknown; it is never searched again automatically",
    NO_RESULT: "CatDB answered with no result",
    SKIPPED_INELIGIBLE: "no full VIN to search",
};

function local(result, name) {
    const when = result?.searched_at ? `last lookup ${formatDate(result.searched_at)}` : undefined;
    if (!result || result.status === "NOT_REQUESTED") return { node: <CellStatus state="NOT_REQUESTED" /> };
    if (result.status === "FAILED" && result.price_expected == null) return { node: <CellStatus state="FAILED" detail={when} /> };
    if (result.status === "NO_MATCH" || result.price_expected == null) return { node: <CellStatus state="NO_MATCH" detail={when} /> };
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
