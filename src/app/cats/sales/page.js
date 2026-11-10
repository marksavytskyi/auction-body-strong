"use client";

import React, { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Loader2, History, RefreshCw, FileSpreadsheet } from "lucide-react";

import { createSale, listSales, CatalyticApiError } from "@/lib/catalytic/api";
import { pick } from "@/lib/catalytic/normalize";
import SaleForm from "@/components/catalytic/SaleForm";
import { SourceBadge } from "@/components/catalytic/badges";
import { useAdminTierGate } from "@/hooks/useRoleGate";
import SalesImport from "@/components/catalytic/SalesImport";
import SalesLinking from "@/components/catalytic/SalesLinking";

function fmtMoney(n, currency) {
    if (n === null || n === undefined || !Number.isFinite(Number(n))) return "—";
    try {
        return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD", maximumFractionDigits: 2 }).format(n);
    } catch {
        return `$${n}`;
    }
}

function fmtDate(s) {
    if (!s) return "—";
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString();
}

export default function SalesPage() {
    const { ready } = useAdminTierGate();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [sales, setSales] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState("");
    const [importing, setImporting] = useState(false);
    const [linkRefresh, setLinkRefresh] = useState(0);

    const loadSales = useCallback(async () => {
        setIsLoading(true);
        setLoadError("");
        try {
            const data = await listSales({ limit: 50 });
            const rows = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : Array.isArray(data?.results) ? data.results : [];
            setSales(rows);
        } catch (e) {
            setLoadError(e instanceof CatalyticApiError ? e.message : "Failed to load sales history");
            setSales(null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadSales();
    }, [loadSales]);

    const handleSubmit = useCallback(
        async (payload) => {
            setIsSubmitting(true);
            try {
                await createSale(payload);
                toast.success("Sale recorded");
                loadSales();
            } catch (e) {
                toast.error(e instanceof CatalyticApiError ? e.message : "Failed to record sale");
            } finally {
                setIsSubmitting(false);
            }
        },
        [loadSales]
    );

    if (!ready) return null;

    return (
        <div className="space-y-6">
        <section aria-label="Import sales" className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-white/40 font-bold">
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" /> Import Sales
                </div>
                <button type="button" aria-expanded={importing} onClick={() => setImporting((v) => !v)}
                    className="h-9 rounded-lg border border-white/15 px-3 text-xs font-bold text-white/80">
                    {importing ? "Close" : "Import a file…"}
                </button>
            </div>
            {importing && <SalesImport onImported={() => { loadSales(); setLinkRefresh((k) => k + 1); }} />}
        </section>
        <SalesLinking refreshKey={linkRefresh} />
        {/* minmax(0,…): a wide sales table must scroll inside its card, never widen the page on a phone. */}
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6 h-fit">
                <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-white/40 font-bold mb-4">
                    Record Sale
                </div>
                <SaleForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                    <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-white/40 font-bold">
                        <History className="h-3.5 w-3.5 text-emerald-400" />
                        Our Sales History
                        <SourceBadge source={{ code: "OUR_SALES", label: "Our data", tone: "verified" }} />
                    </div>
                    <button
                        type="button"
                        onClick={loadSales}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
                    </button>
                </div>

                {isLoading ? (
                    <div className="flex items-center gap-2 text-white/50 text-sm py-8 justify-center">
                        <Loader2 className="h-4 w-4 animate-spin" /> Loading sales…
                    </div>
                ) : loadError ? (
                    <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium">{loadError}</div>
                ) : !sales || sales.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-black/25 p-8 text-center text-sm text-white/45">No sales recorded yet.</div>
                ) : (
                    <div className="overflow-auto rounded-2xl border border-white/10 bg-black/25">
                        <table className="w-full text-sm">
                            <thead className="bg-black/40 sticky top-0">
                                <tr>
                                    {["Code", "Buyer", "Price", "Qty", "Condition", "Date"].map((h) => (
                                        <th key={h} className="px-3 py-2 text-left text-[11px] uppercase tracking-wider text-white/50 font-bold border-b border-white/10 whitespace-nowrap">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {sales.map((s, idx) => (
                                    <tr key={s.id ?? idx} className="odd:bg-white/[0.02]">
                                        <td className="px-3 py-2 border-b border-white/5 font-mono text-xs text-white/85 whitespace-nowrap">
                                            {pick(s, ["physical_code"], "—")}
                                        </td>
                                        <td className="px-3 py-2 border-b border-white/5 text-white/70 whitespace-nowrap">{s.buyer || "—"}</td>
                                        <td className="px-3 py-2 border-b border-white/5 text-emerald-300 font-semibold whitespace-nowrap">
                                            {fmtMoney(s.sale_price, s.currency)}
                                        </td>
                                        <td className="px-3 py-2 border-b border-white/5 text-white/70 whitespace-nowrap">{s.quantity ?? 1}</td>
                                        <td className="px-3 py-2 border-b border-white/5 text-white/70 whitespace-nowrap">{s.condition || "—"}</td>
                                        <td className="px-3 py-2 border-b border-white/5 text-white/50 whitespace-nowrap">
                                            {fmtDate(s.sale_date)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
        </div>
    );
}
