"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Car, Hash, Layers, Code2, ClipboardPlus, ChevronDown, ChevronUp, SlidersHorizontal } from "lucide-react";
import { normalizeCatdbSnapshot } from "@/lib/catalytic/catdb";
import { ConfidenceBadge, SourceBadge } from "./badges";
import PriceRange from "./PriceRange";
import CatdbCard from "./CatdbCard";
import OurDbCard from "./OurDbCard";

function CandidateRow({ candidate, onRecordObservation }) {
    const pct = candidate.probability !== null ? Math.round(candidate.probability * 100) : null;
    const hasRealObservations = Number(candidate.observedCount) > 0;

    return (
        <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-black/25 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 min-w-0">
                <div className="p-1.5 rounded-lg bg-white/5 border border-white/10 shrink-0">
                    <Code2 className="h-3.5 w-3.5 text-white/50" />
                </div>
                <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-bold text-white/90 truncate">{candidate.code}</span>
                        {pct !== null && <span className="text-xs text-white/50 font-semibold">{pct}% match</span>}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <SourceBadge source={candidate.source} />
                        {hasRealObservations && (
                            <span className="text-[10px] text-emerald-300/80 font-medium">
                                Observed {candidate.observedCount}x
                            </span>
                        )}
                        {candidate.sampleCount !== null && candidate.sampleCount !== undefined && (
                            <span className="text-[10px] text-white/40 font-medium">
                                {candidate.sampleCount} sample{candidate.sampleCount === 1 ? "" : "s"}
                            </span>
                        )}
                        {Number(candidate.rejectedCount) > 0 && (
                            <span className="text-[10px] text-rose-400/80 font-medium">Rejected {candidate.rejectedCount}x</span>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-3 shrink-0 justify-between sm:justify-end">
                <PriceRange pricing={candidate.price} size="sm" />
                {onRecordObservation && (
                    <button
                        type="button"
                        onClick={() => onRecordObservation(candidate)}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300 hover:bg-emerald-500/20 transition-colors"
                        title="Record this as the observed converter"
                    >
                        <ClipboardPlus className="h-3 w-3" />
                        Found
                    </button>
                )}
            </div>
        </div>
    );
}

function PositionCard({ position, onRecordObservation }) {
    const sorted = [...position.candidates].sort((a, b) => (b.probability || 0) - (a.probability || 0));

    return (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-white/5 bg-white/[0.03]">
                <div className="flex items-center gap-2 min-w-0">
                    <Layers className="h-4 w-4 text-white/40 shrink-0" />
                    <span className="font-bold text-sm text-white/90 truncate">{position.name}</span>
                    <PriceRange pricing={position.pricing} size="sm" />
                </div>
                {position.confidence !== null ? (
                    <ConfidenceBadge confidence={position.confidence} />
                ) : position.topProbability !== null ? (
                    <span
                        title="Derived from the highest candidate probability — this endpoint does not report a per-position confidence value directly."
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border border-white/15 bg-white/5 text-white/50 whitespace-nowrap"
                    >
                        Top match {Math.round(position.topProbability * 100)}%
                    </span>
                ) : null}
            </div>

            <div className="p-3 space-y-2">
                {sorted.length ? (
                    sorted.map((c, idx) => (
                        <CandidateRow key={c.id ?? `${position.id}_${idx}`} candidate={c} onRecordObservation={onRecordObservation ? () => onRecordObservation(position, c) : null} />
                    ))
                ) : (
                    <div className="px-2 py-4 text-center text-xs text-white/35 italic">No candidate converters reported for this position.</div>
                )}
            </div>
        </div>
    );
}

export default function LookupResult({ result, vin, onRecordObservation }) {
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [showRaw, setShowRaw] = useState(false);

    if (!result) return null;

    // No backend contract for CatDB exists yet — this always resolves to
    // the honest NO_DATA/contractMissing state (see lib/catalytic/catdb.js).
    const catdbSnapshot = normalizeCatdbSnapshot(result.raw);

    return (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="space-y-5">
            {/* Vehicle identity */}
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5 sm:p-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-white/5 border border-white/10 shrink-0">
                        <Car className="h-5 w-5 text-white/60" />
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-xl sm:text-2xl font-black text-white truncate">
                            {[result.year, result.make, result.model].filter(Boolean).join(" ") || "Vehicle"}
                        </h2>
                        <div className="flex items-center gap-3 mt-0.5 text-sm text-white/45 flex-wrap">
                            {result.engine && <span>{result.engine}</span>}
                            {vin && (
                                <span className="inline-flex items-center gap-1 font-mono text-xs">
                                    <Hash className="h-3 w-3" /> {vin}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* CatDB vs Our Database — always independent, never blended */}
            <div className="grid gap-4 sm:grid-cols-2">
                <CatdbCard snapshot={catdbSnapshot} />
                <OurDbCard result={result} />
            </div>

            {/* Advanced / technical details, collapsed by default */}
            <div className="rounded-2xl border border-white/10 bg-black/20 overflow-hidden">
                <button
                    type="button"
                    onClick={() => setShowAdvanced((s) => !s)}
                    className="w-full flex items-center justify-between px-4 py-3 text-xs uppercase tracking-wider font-bold text-white/50 hover:text-white/80 transition-colors"
                >
                    <span className="inline-flex items-center gap-2">
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                        Advanced Details (positions, candidates, probabilities)
                    </span>
                    {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>

                {showAdvanced && (
                    <div className="p-4 pt-0 space-y-3">
                        {result.positions.length ? (
                            result.positions.map((p, idx) => (
                                <PositionCard key={p.id ?? idx} position={p} onRecordObservation={onRecordObservation} />
                            ))
                        ) : (
                            <div className="rounded-2xl border border-white/10 bg-black/30 p-8 text-sm text-white/55 text-center">
                                No catalyst positions were returned for this vehicle configuration.
                            </div>
                        )}

                        <div className="rounded-2xl border border-white/10 bg-black/20">
                            <button
                                type="button"
                                onClick={() => setShowRaw((s) => !s)}
                                className="w-full flex items-center justify-between px-4 py-2.5 text-[10px] uppercase tracking-wider font-bold text-white/40 hover:text-white/70 transition-colors"
                            >
                                Raw backend response
                                {showRaw ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            </button>
                            {showRaw && (
                                <pre className="px-4 pb-4 text-[10px] leading-relaxed text-white/50 overflow-auto max-h-64 whitespace-pre-wrap break-all">
                                    {JSON.stringify(result.raw, null, 2)}
                                </pre>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </motion.div>
    );
}
