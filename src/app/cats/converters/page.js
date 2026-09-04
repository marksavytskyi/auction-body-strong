"use client";

import React, { useCallback, useState } from "react";
import Link from "next/link";
import { Search, Loader2, Code2, ArrowRight, Scale } from "lucide-react";

import { searchConverters, CatalyticApiError } from "@/lib/catalytic/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// ConverterSummary from the real backend only carries
// { id, canonical_code, weight_kg, material } — no pricing/CatDB id here,
// that detail lives on GET /catalytic/converters/{id}.
export default function ConvertersSearchPage() {
    const [code, setCode] = useState("");
    const [results, setResults] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [searched, setSearched] = useState(false);

    const runSearch = useCallback(async (e) => {
        e?.preventDefault?.();
        const q = code.trim();
        if (!q) return;
        setIsLoading(true);
        setError("");
        setSearched(true);
        try {
            const data = await searchConverters(q);
            setResults(Array.isArray(data) ? data : []);
        } catch (e2) {
            setError(e2 instanceof CatalyticApiError ? e2.message : "Search failed");
            setResults(null);
        } finally {
            setIsLoading(false);
        }
    }, [code]);

    return (
        <div className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5 sm:p-6">
                <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-white/40 font-bold mb-4">
                    <Code2 className="h-3.5 w-3.5 text-sky-400" />
                    Converter Search
                </div>
                <form onSubmit={runSearch} className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25" />
                        <Input
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            placeholder="Physical code or alias, e.g. EA6"
                            className="pl-11 h-12 rounded-2xl bg-white/5 border-white/10 font-mono uppercase"
                        />
                    </div>
                    <Button type="submit" className="h-12 rounded-2xl px-6" isLoading={isLoading} disabled={isLoading || !code.trim()}>
                        Search
                    </Button>
                </form>
            </div>

            {error && (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium">{error}</div>
            )}

            {isLoading ? (
                <div className="flex items-center gap-2 text-white/50 text-sm py-8 justify-center">
                    <Loader2 className="h-4 w-4 animate-spin" /> Searching…
                </div>
            ) : searched && (!results || results.length === 0) && !error ? (
                <div className="rounded-2xl border border-white/10 bg-black/25 p-8 text-center text-sm text-white/45">
                    No converters found for &ldquo;{code}&rdquo;.
                </div>
            ) : results && results.length > 0 ? (
                <div className="space-y-2">
                    {results.map((c) => (
                        <Link
                            key={c.id}
                            href={`/cats/converters/${encodeURIComponent(c.id)}`}
                            className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] transition-colors px-4 py-3"
                        >
                            <div>
                                <div className="font-mono font-bold text-sm text-white/90">{c.canonical_code}</div>
                                <div className="text-[11px] text-white/40">{c.material || "Unknown material"}</div>
                            </div>
                            <div className="flex items-center gap-3">
                                {c.weight_kg !== null && c.weight_kg !== undefined && (
                                    <span className="inline-flex items-center gap-1 text-[11px] text-white/45">
                                        <Scale className="h-3 w-3" /> {c.weight_kg} kg
                                    </span>
                                )}
                                <ArrowRight className="h-4 w-4 text-white/30" />
                            </div>
                        </Link>
                    ))}
                </div>
            ) : (
                !searched && (
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-8 text-center text-sm text-white/45">
                        Search by physical code or alias to find converter records.
                    </div>
                )
            )}
        </div>
    );
}
