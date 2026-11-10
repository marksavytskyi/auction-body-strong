"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";

import { getLinkSuggestions, linkImportedSale, listImportedSales } from "@/lib/catalytic/salesImport";
import { CatalyticApiError } from "@/lib/catalytic/http";
import { isAll, showingLabel } from "@/lib/pagination";
import usePagedRows from "@/hooks/usePagedRows";
import PageSizeSelect from "@/components/ui/PageSizeSelect";
import LoadMoreRows from "@/components/ui/LoadMoreRows";
import { ConfirmDialog } from "@/components/catalytic/CatdbProcessingControls";

// K.51 review — Our Database prices a vehicle from the sales of converters listed on its
// catalog positions. An imported sale whose converter is on no vehicle is kept but unused.
// Here a person sees which is which and can point an unlinked sale at an existing
// converter. Nothing here links a converter to a vehicle: that is recorded as a verified
// observation.

const small = "h-9 rounded-lg border px-3 text-xs font-bold disabled:opacity-40";
const FILTERS = [["unlinked", "Unlinked"], ["linked", "Linked"], ["", "All"]];

function LinkPanel({ sale, onLinked, onClose }) {
    const [search, setSearch] = useState("");
    const [options, setOptions] = useState(null);
    const [choice, setChoice] = useState(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => {
            getLinkSuggestions(sale.sale_id, search.trim()).then((d) => setOptions(d.items)).catch(() => setOptions([]));
        }, search ? 300 : 0);
        return () => clearTimeout(t);
    }, [sale.sale_id, search]);

    const confirm = async () => {
        setBusy(true);
        try {
            await linkImportedSale(sale.sale_id, choice.converter_id);
            toast.success(`Sale linked to ${choice.code}`);
            setChoice(null);
            onLinked();
        } catch (e) {
            toast.error(e instanceof CatalyticApiError ? e.message : "Failed to link the sale");
        } finally {
            setBusy(false);
        }
    };

    const observe = `/cats/observations?record=1&code=${encodeURIComponent(sale.physical_code)}`;
    return (
        <div className="space-y-2 rounded-xl border border-white/10 bg-black/40 p-3 text-xs">
            <div className="text-white/70">
                Is <b className="font-mono">{sale.physical_code}</b> another name for a converter already in the catalog? Pick it, and this sale counts for every vehicle that converter is listed on.
            </div>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search catalog codes" aria-label="Search catalog codes"
                className="h-9 w-full max-w-xs rounded-lg border border-white/10 bg-white/5 px-2 text-white" />
            {options === null ? <Loader2 className="h-4 w-4 animate-spin text-white/40" /> : !options.length ? (
                <p className="text-white/45">{search ? "No catalog code matches." : "No similar code is linked to a vehicle."}</p>
            ) : (
                <ul className="space-y-1" aria-label="Catalog converters">
                    {options.map((o) => (
                        <li key={o.converter_id} className="flex flex-wrap items-center justify-between gap-2">
                            <span><span className="font-mono text-white/85">{o.code}</span>
                                <span className="ml-2 text-white/45">{o.vehicle_positions ? `on ${o.vehicle_positions} vehicle position${o.vehicle_positions === 1 ? "" : "s"}` : "not on any vehicle either"}</span></span>
                            <button type="button" className={`${small} border-emerald-500/40 text-emerald-200`} onClick={() => setChoice(o)}>Link to {o.code}</button>
                        </li>
                    ))}
                </ul>
            )}
            <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-2 text-white/50">
                <span>If it really is its own converter, record which vehicle it came off:</span>
                <Link href={observe} className="underline">Record observation for {sale.vehicle || "this vehicle"}</Link>
                <button type="button" className="ml-auto underline" onClick={onClose}>Close</button>
            </div>
            {choice && (
                <ConfirmDialog
                    action={{
                        title: `Link this sale to ${choice.code}?`,
                        body: `The sale (${sale.physical_code}, ${sale.unit_price} ${sale.currency}) then counts as a ${choice.code} sale in Our Database. The code as written stays on the sale and the change is noted on it. No vehicle is linked to any converter.`,
                        confirm: "Link sale",
                    }}
                    busy={busy}
                    onConfirm={confirm}
                    onClose={() => setChoice(null)}
                />
            )}
        </div>
    );
}

export default function SalesLinking({ refreshKey }) {
    const [link, setLink] = useState("unlinked");
    const [pageSize, setPageSize] = useState(25);
    const [page, setPage] = useState(0);
    const [open, setOpen] = useState(null);
    const [local, setLocal] = useState(0);
    const [counts, setCounts] = useState(null);
    const fetchPage = useCallback(async (limit, offset) => {
        const data = await listImportedSales({ limit, offset, link: link || undefined });
        setCounts(data.counts);
        return data;
    }, [link]);
    const { rows, total, loadingMore, loadMoreFailed, hasMore, loadMore, error } = usePagedRows({ fetchPage, pageSize, page, refreshKey: `${refreshKey}-${local}` });

    if (counts && counts.total === 0) return null;
    return (
        <section aria-label="Imported sales in Our Database" className="space-y-3 rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
            <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/40">Imported sales in Our Database</div>
            {counts && (
                <p className="text-xs text-white/60">
                    <b className="text-emerald-300">{counts.linked} linked</b>: their converter is listed on a vehicle, so Our Database uses them.{" "}
                    <b className="text-amber-200">{counts.unlinked} unlinked</b>: kept, but not used until their converter is on a vehicle.
                </p>
            )}
            <div className="flex flex-wrap gap-1.5">
                {FILTERS.map(([id, label]) => (
                    <button key={label} type="button" aria-pressed={link === id} onClick={() => { setLink(id); setOpen(null); setPage(0); }}
                        className={`h-8 rounded-xl border px-3 text-[11px] font-bold uppercase tracking-wider ${link === id ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300" : "border-white/10 text-white/50"}`}>
                        {label}{counts && id ? ` ${counts[id]}` : ""}
                    </button>
                ))}
            </div>
            {error ? <p className="text-xs text-rose-300">{error instanceof CatalyticApiError ? error.message : "Failed to load imported sales"}</p>
                : rows === null ? <Loader2 className="h-4 w-4 animate-spin text-white/40" />
                : !rows.length ? <p className="text-xs text-white/45">None here.</p> : (
                <div className="space-y-2">
                    {rows.map((s) => (
                        <div key={s.sale_id} className="space-y-2 rounded-xl border border-white/10 bg-black/25 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                <div className="min-w-0">
                                    <span className="font-mono font-bold text-white/85">{s.physical_code}</span>
                                    {s.converter_code && s.converter_code !== s.physical_code && <span className="ml-1.5 text-white/45">as {s.converter_code}</span>}
                                    <span className="ml-2 text-white/60">{s.unit_price} {s.currency} × {s.quantity}</span>
                                    <div className="text-[11px] text-white/40">{s.vehicle || "No vehicle in the file"} · {s.filename} row {s.row_number}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${s.linked ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-amber-500/30 bg-amber-500/10 text-amber-200"}`}>
                                        {s.linked ? `Linked · ${s.vehicle_positions} position${s.vehicle_positions === 1 ? "" : "s"}` : "Unlinked"}
                                    </span>
                                    {!s.linked && <button type="button" className={`${small} border-white/15 text-white/80`} onClick={() => setOpen(open === s.sale_id ? null : s.sale_id)}>Link…</button>}
                                </div>
                            </div>
                            {open === s.sale_id && <LinkPanel sale={s} onClose={() => setOpen(null)} onLinked={() => { setOpen(null); setLocal((k) => k + 1); }} />}
                        </div>
                    ))}
                    <LoadMoreRows hasMore={hasMore} loading={loadingMore} failed={loadMoreFailed} onLoadMore={loadMore} loadedCount={rows.length} />
                </div>
            )}
            <div className="flex items-center justify-between gap-2 text-xs text-white/40">
                <span>{showingLabel({ pageSize, page, shown: rows?.length || 0, total, noun: "sale" })}</span>
                <div className="flex items-center gap-2">
                    <PageSizeSelect value={pageSize} onChange={(n) => { setPage(0); setPageSize(n); }} />
                    {!isAll(pageSize) && <>
                        <button type="button" disabled={page === 0} onClick={() => setPage((x) => x - 1)} className={`${small} border-white/10 text-white/70`}>Prev</button>
                        <button type="button" disabled={(page + 1) * pageSize >= total} onClick={() => setPage((x) => x + 1)} className={`${small} border-white/10 text-white/70`}>Next</button>
                    </>}
                </div>
            </div>
        </section>
    );
}
