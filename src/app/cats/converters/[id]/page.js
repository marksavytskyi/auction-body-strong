"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Code2, Tag, Database, ClipboardList, Receipt, Weight, Shapes } from "lucide-react";

import { getConverter, CatalyticApiError } from "@/lib/catalytic/api";
import { normalizePriceEstimate, normalizeSource } from "@/lib/catalytic/normalize";
import { SourceBadge } from "@/components/catalytic/badges";
import PriceRange from "@/components/catalytic/PriceRange";
import { Button } from "@/components/ui/button";

function Section({ icon: Icon, title, children }) {
    return (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-white/40 font-bold mb-3">
                <Icon className="h-3.5 w-3.5" />
                {title}
            </div>
            {children}
        </div>
    );
}

function fmtDate(s) {
    if (!s) return "—";
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString();
}

// Matches the real ConverterDetail schema exactly. There is no
// vehicle-association field on this endpoint — do not fabricate one.
export default function ConverterDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params?.id;

    const [converter, setConverter] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!id) return;
        let cancelled = false;
        setIsLoading(true);
        setError("");
        getConverter(id)
            .then((data) => !cancelled && setConverter(data))
            .catch((e) => !cancelled && setError(e instanceof CatalyticApiError ? e.message : "Failed to load converter"))
            .finally(() => !cancelled && setIsLoading(false));
        return () => {
            cancelled = true;
        };
    }, [id]);

    if (isLoading) {
        return (
            <div className="flex items-center gap-2 text-white/50 text-sm py-12 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading converter…
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-4">
                <Button variant="outline" size="sm" className="rounded-xl border-white/15" onClick={() => router.push("/cats/converters")}>
                    <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to search
                </Button>
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium">{error}</div>
            </div>
        );
    }

    if (!converter) return null;

    const currentPrice = normalizePriceEstimate(converter.current_price);
    const currentPricing = currentPrice ? { low: currentPrice.low, expected: currentPrice.expected, high: currentPrice.high, currency: currentPrice.currency } : null;

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <Button variant="outline" size="sm" className="rounded-xl border-white/15" onClick={() => router.push("/cats/converters")}>
                    <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to search
                </Button>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-white/40 font-bold">
                            <Code2 className="h-3.5 w-3.5 text-sky-400" />
                            Converter Detail
                        </div>
                        <h1 className="mt-1 text-2xl font-black font-mono text-white">{converter.canonical_code}</h1>
                        <div className="flex items-center gap-3 mt-2 text-xs text-white/40 flex-wrap">
                            {converter.material && <span>Material: {converter.material}</span>}
                            {converter.shape && (
                                <span className="inline-flex items-center gap-1"><Shapes className="h-3 w-3" /> {converter.shape}</span>
                            )}
                            {converter.weight_kg !== null && converter.weight_kg !== undefined && (
                                <span className="inline-flex items-center gap-1"><Weight className="h-3 w-3" /> {converter.weight_kg} kg</span>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-col items-start sm:items-end gap-1.5">
                        {currentPrice?.source && <SourceBadge source={normalizeSource(currentPrice.source)} />}
                        <PriceRange pricing={currentPricing} size="lg" />
                    </div>
                </div>

                {Array.isArray(converter.aliases) && converter.aliases.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1.5">
                        {converter.aliases.map((a, idx) => (
                            <span
                                key={idx}
                                title={`${a.alias_type} · source: ${a.source} · confidence ${Math.round((a.confidence || 0) * 100)}%`}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border border-white/10 bg-white/5 text-white/60"
                            >
                                <Tag className="h-3 w-3" />
                                {a.alias}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <Section icon={Database} title="External Reference Prices (CatDB / Ecotrade)">
                    {Array.isArray(converter.external_prices) && converter.external_prices.length ? (
                        <ul className="space-y-2">
                            {converter.external_prices.map((p, idx) => (
                                <li key={idx} className="flex items-center justify-between text-sm gap-2">
                                    <SourceBadge source={normalizeSource(p.source)} />
                                    <PriceRange pricing={{ low: p.price_low, expected: p.price_avg, high: p.price_high, currency: p.currency }} size="sm" />
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-xs text-white/35 italic">No external reference pricing reported.</p>
                    )}
                </Section>

                <Section icon={Receipt} title="Our Sales">
                    {Array.isArray(converter.recent_sales) && converter.recent_sales.length ? (
                        <ul className="space-y-1.5 text-sm text-white/75">
                            {converter.recent_sales.map((s) => (
                                <li key={s.id} className="flex items-center justify-between">
                                    <span>{fmtDate(s.sale_date)} {s.buyer ? `· ${s.buyer}` : ""}</span>
                                    <span className="text-emerald-300 font-semibold">{s.sale_price} {s.currency}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-xs text-white/35 italic">No sales recorded yet.</p>
                    )}
                </Section>

                <Section icon={ClipboardList} title="Observations">
                    {Array.isArray(converter.recent_observations) && converter.recent_observations.length ? (
                        <ul className="space-y-1.5 text-sm text-white/75">
                            {converter.recent_observations.map((o) => (
                                <li key={o.id} className="truncate">
                                    {fmtDate(o.created_at)} — {o.physical_code_raw || "no code"} {o.notes ? `· ${o.notes}` : ""}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-xs text-white/35 italic">No observations recorded yet.</p>
                    )}
                </Section>

                <Section icon={Database} title="Composition">
                    <ul className="space-y-1.5 text-sm text-white/75">
                        {converter.substrate_vol_l !== null && converter.substrate_vol_l !== undefined && (
                            <li className="flex justify-between"><span className="text-white/45">Substrate volume</span><span>{converter.substrate_vol_l} L</span></li>
                        )}
                        {converter.pt_g !== null && converter.pt_g !== undefined && (
                            <li className="flex justify-between"><span className="text-white/45">Platinum (Pt)</span><span>{converter.pt_g} g</span></li>
                        )}
                        {converter.pd_g !== null && converter.pd_g !== undefined && (
                            <li className="flex justify-between"><span className="text-white/45">Palladium (Pd)</span><span>{converter.pd_g} g</span></li>
                        )}
                        {converter.rh_g !== null && converter.rh_g !== undefined && (
                            <li className="flex justify-between"><span className="text-white/45">Rhodium (Rh)</span><span>{converter.rh_g} g</span></li>
                        )}
                        {converter.notes && <li className="pt-1 text-white/40 italic">{converter.notes}</li>}
                        {converter.substrate_vol_l === null && converter.pt_g === null && converter.pd_g === null && converter.rh_g === null && !converter.notes && (
                            <p className="text-xs text-white/35 italic">No composition data reported.</p>
                        )}
                    </ul>
                </Section>
            </div>
        </div>
    );
}
