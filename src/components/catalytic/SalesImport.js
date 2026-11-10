"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Loader2, Sparkles, Upload } from "lucide-react";

import {
    applySalesImportTemplate,
    commitSalesImport,
    discardSalesImport,
    editSalesImportRow,
    getSalesImport,
    listSalesImportRows,
    listSalesImportTemplates,
    listSalesImports,
    saveSalesImportTemplate,
    setSalesImportDecision,
    setSalesImportMapping,
    setSalesImportStructure,
    suggestSalesImportMapping,
    uploadSalesFile,
} from "@/lib/catalytic/salesImport";
import { CatalyticApiError } from "@/lib/catalytic/http";
import { isAll, showingLabel } from "@/lib/pagination";
import usePagedRows from "@/hooks/usePagedRows";
import PageSizeSelect from "@/components/ui/PageSizeSelect";
import LoadMoreRows from "@/components/ui/LoadMoreRows";
import { ConfirmDialog } from "@/components/catalytic/CatdbProcessingControls";

// Phase K.51 — upload a sales file of any layout, check how its columns map, review
// the rows (fixing only the problem ones) and confirm. Nothing is saved as a sale until
// Import Approved Sales. Only completed converter sales belong here: offers, estimates
// and vehicle prices are kept out.

const STATUS = {
    READY: { label: "Ready", tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" },
    REQUIRES_REVIEW: { label: "Review", tone: "border-amber-500/30 bg-amber-500/10 text-amber-200" },
    DUPLICATE: { label: "Duplicate", tone: "border-sky-500/30 bg-sky-500/10 text-sky-200" },
    NOT_A_SALE: { label: "Not a sale", tone: "border-white/15 bg-white/5 text-white/60" },
    AMBIGUOUS: { label: "Ambiguous", tone: "border-amber-500/30 bg-amber-500/10 text-amber-200" },
    MISSING_REQUIRED: { label: "Missing data", tone: "border-rose-500/30 bg-rose-500/10 text-rose-200" },
    INVALID: { label: "Invalid", tone: "border-rose-500/30 bg-rose-500/10 text-rose-200" },
};
const INCLUDABLE = ["REQUIRES_REVIEW", "DUPLICATE"];
const EDIT_FIELDS = [
    ["converter_code", "Converter code"], ["unit_price", "Unit price"], ["quantity", "Qty"],
    ["sale_date", "Sale date (YYYY-MM-DD)"], ["currency", "Currency"], ["buyer", "Buyer"],
];
const msg = (e, fallback) => (e instanceof CatalyticApiError ? e.message : fallback);
const small = "h-9 rounded-lg border px-3 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed";

function Pill({ status }) {
    const s = STATUS[status] || { label: status, tone: "border-white/15 text-white/60" };
    return <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${s.tone}`}>{s.label}</span>;
}

function MappingStep({ imp, onChange, samples }) {
    const [mapping, setMapping] = useState(imp.mapping);
    const [options, setOptions] = useState(imp.options);
    const [templates, setTemplates] = useState([]);
    const [templateName, setTemplateName] = useState("");
    const [proposal, setProposal] = useState(null);
    const [busy, setBusy] = useState("");
    useEffect(() => { setMapping(imp.mapping); setOptions(imp.options); }, [imp]);
    useEffect(() => { listSalesImportTemplates().then(setTemplates).catch(() => setTemplates([])); }, []);

    const run = async (name, fn, done) => {
        setBusy(name);
        try {
            const result = await fn();
            if (done) toast.success(done);
            return result;
        } catch (e) {
            toast.error(msg(e, "That didn't work"));
            return null;
        } finally {
            setBusy("");
        }
    };
    const used = Object.values(mapping).filter(Boolean);
    const dirty = JSON.stringify(mapping) !== JSON.stringify(imp.mapping) || JSON.stringify(options) !== JSON.stringify(imp.options);

    return (
        <section aria-label="Column mapping" className="space-y-3 rounded-2xl border border-white/10 bg-black/25 p-4">
            <div className="flex flex-wrap items-end gap-3 text-xs">
                {imp.sheet_names.length > 1 && (
                    <label className="space-y-1 text-white/60">
                        <span className="block">Worksheet</span>
                        <select value={imp.sheet_name || ""} onChange={async (e) => { const r = await run("sheet", () => setSalesImportStructure(imp.id, { sheetName: e.target.value })); if (r) onChange(r); }}
                            className="h-9 rounded-lg border border-white/10 bg-[#0b0d12] px-2 text-white/85">
                            {imp.sheet_names.map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                    </label>
                )}
                <label className="space-y-1 text-white/60">
                    <span className="block">Header row</span>
                    <input type="number" min={1} defaultValue={imp.header_row + 1} key={imp.header_row}
                        onBlur={async (e) => { const n = Number(e.target.value) - 1; if (n >= 0 && n !== imp.header_row) { const r = await run("header", () => setSalesImportStructure(imp.id, { headerRow: n })); if (r) onChange(r); } }}
                        className="h-9 w-20 rounded-lg border border-white/10 bg-white/5 px-2 text-white/85" aria-label="Header row" />
                </label>
                {templates.length > 0 && (
                    <label className="space-y-1 text-white/60">
                        <span className="block">Saved template</span>
                        <select value={imp.template?.id || ""} onChange={async (e) => { if (!e.target.value) return; const r = await run("tpl", () => applySalesImportTemplate(imp.id, Number(e.target.value)), "Template applied"); if (r) onChange(r); }}
                            className="h-9 rounded-lg border border-white/10 bg-[#0b0d12] px-2 text-white/85" aria-label="Saved template">
                            <option value="">—</option>
                            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </label>
                )}
            </div>
            {imp.template && <p className="text-[11px] text-emerald-200/80">Using the saved template &quot;{imp.template.name}&quot;: this file has the same columns. Change anything below if it doesn&apos;t fit.</p>}
            {imp.already_imported_as && <p className="text-[11px] text-amber-200/90">This exact file was already imported (import #{imp.already_imported_as.id}). Rows already recorded show as duplicates.</p>}

            <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-xs">
                    <thead className="bg-black/40"><tr>{["Column in the file", "Example", "STRONGG field"].map((h) => <th key={h} className="px-3 py-2 text-left font-bold uppercase tracking-wider text-white/50">{h}</th>)}</tr></thead>
                    <tbody>
                        {imp.headers.map((h) => (
                            <tr key={h} className="odd:bg-white/[0.02]">
                                <td className="px-3 py-1.5 text-white/85">{h}</td>
                                <td className="max-w-[220px] truncate px-3 py-1.5 text-white/45" title={samples[h]}>{samples[h] || "—"}</td>
                                <td className="px-3 py-1.5">
                                    <select aria-label={`Field for ${h}`} value={mapping[h] || ""} onChange={(e) => setMapping((m) => ({ ...m, [h]: e.target.value }))}
                                        className="h-8 rounded-lg border border-white/10 bg-[#0b0d12] px-2 text-white/85">
                                        <option value="">Ignore</option>
                                        {Object.entries(imp.fields).map(([key, label]) => (
                                            <option key={key} value={key} disabled={key !== mapping[h] && used.includes(key)}>{label}</option>
                                        ))}
                                    </select>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-white/70">
                <label className="inline-flex items-center gap-1.5">Currency when a row doesn&apos;t say
                    <select aria-label="Default currency" value={options.default_currency || ""} onChange={(e) => setOptions((o) => ({ ...o, default_currency: e.target.value }))}
                        className="h-8 rounded-lg border border-white/10 bg-[#0b0d12] px-2">
                        <option value="USD">USD</option><option value="">None: every row must say</option>
                    </select>
                </label>
                <label className="inline-flex items-center gap-1.5">Dates like 03/04
                    <select aria-label="Date order" value={options.date_order || ""} onChange={(e) => setOptions((o) => ({ ...o, date_order: e.target.value }))}
                        className="h-8 rounded-lg border border-white/10 bg-[#0b0d12] px-2">
                        <option value="">Ask per row</option><option value="MDY">month/day</option><option value="DMY">day/month</option>
                    </select>
                </label>
                <label className="inline-flex items-center gap-1.5">
                    <input type="checkbox" className="h-4 w-4" checked={Boolean(options.all_rows_are_sales)} onChange={(e) => setOptions((o) => ({ ...o, all_rows_are_sales: e.target.checked }))} />
                    Every row is a completed catalytic converter sale
                </label>
            </div>
            <p className="text-[11px] text-white/35">Our Database prices in USD and never converts currencies, so other currencies are kept out. Without a transaction type column, tick the box only if the whole file is real sales: not offers, estimates or vehicle prices.</p>
            {imp.mapping_problems.length > 0 && !dirty && <ul className="list-disc pl-5 text-[11px] text-amber-200/90">{imp.mapping_problems.map((p) => <li key={p}>{p}</li>)}</ul>}

            {proposal && (
                <div className="space-y-1.5 rounded-xl border border-sky-500/25 bg-sky-500/[0.05] p-3 text-[11px] text-sky-100">
                    <div className="font-bold">AI suggestion (not applied)</div>
                    <div>{Object.entries(proposal.mapping).filter(([, v]) => v).map(([k, v]) => `${k} → ${imp.fields[v] || v}`).join(" · ") || "No columns it was sure about."}</div>
                    {proposal.rejected.length > 0 && <div className="text-sky-100/70">Not used: {proposal.rejected.map((r) => `${r.column} (${r.reason})`).join("; ")}</div>}
                    <div className="flex gap-2 pt-1">
                        <button type="button" className={`${small} border-sky-500/40 text-sky-100`} onClick={() => { setMapping(proposal.mapping); setProposal(null); }}>Use it</button>
                        <button type="button" className={`${small} border-white/15 text-white/70`} onClick={() => setProposal(null)}>Dismiss</button>
                    </div>
                </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
                <button type="button" disabled={!dirty || Boolean(busy)} className={`${small} border-emerald-500/40 bg-emerald-500/15 text-emerald-200`}
                    onClick={async () => { const r = await run("map", () => setSalesImportMapping(imp.id, { mapping, options }), "Mapping applied"); if (r) onChange(r); }}>
                    {busy === "map" ? "Applying…" : "Apply mapping"}
                </button>
                <button type="button" disabled={Boolean(busy)} className={`${small} border-sky-500/30 text-sky-200`}
                    title="Sends the column names and five sample rows, with emails, phone numbers and VINs hidden"
                    onClick={async () => { const r = await run("ai", () => suggestSalesImportMapping(imp.id)); if (r) setProposal(r); }}>
                    <span className="inline-flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" />{busy === "ai" ? "Asking…" : "Suggest with AI"}</span>
                </button>
                <span className="mx-1 h-5 w-px bg-white/10" />
                <input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Template name" aria-label="Template name"
                    className="h-9 w-40 rounded-lg border border-white/10 bg-white/5 px-2 text-xs text-white" />
                <button type="button" disabled={!templateName.trim() || dirty || Boolean(busy)} title={dirty ? "Apply the mapping first" : undefined} className={`${small} border-white/15 text-white/80`}
                    onClick={async () => { const r = await run("save", () => saveSalesImportTemplate(imp.id, templateName.trim()), "Template saved"); if (r) { setTemplateName(""); onChange(await getSalesImport(imp.id)); } }}>
                    Save as template
                </button>
            </div>
        </section>
    );
}

function RowEditor({ row, importId, onSaved, onCancel }) {
    const [values, setValues] = useState(() => Object.fromEntries(EDIT_FIELDS.map(([k]) => [k, row.edits[k] ?? (row.values[k] ?? "")])));
    const [busy, setBusy] = useState(false);
    return (
        <div className="grid gap-2 rounded-xl border border-white/10 bg-black/40 p-3 sm:grid-cols-3">
            {EDIT_FIELDS.map(([key, label]) => (
                <label key={key} className="space-y-1 text-[11px] text-white/50">
                    <span className="block">{label}</span>
                    <input value={values[key] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))} aria-label={label}
                        className="h-9 w-full rounded-lg border border-white/10 bg-white/5 px-2 text-sm text-white sm:text-xs" />
                </label>
            ))}
            <div className="flex items-end gap-2 sm:col-span-3">
                <button type="button" disabled={busy} className={`${small} border-emerald-500/40 text-emerald-200`} onClick={async () => {
                    setBusy(true);
                    try {
                        await editSalesImportRow(importId, row.id, values);
                        onSaved();
                    } catch (e) {
                        toast.error(msg(e, "Failed to save the row"));
                    } finally {
                        setBusy(false);
                    }
                }}>Save row</button>
                <button type="button" className={`${small} border-white/15 text-white/70`} onClick={onCancel}>Cancel</button>
                <span className="text-[11px] text-white/35">The file&apos;s own value stays visible; your edit is kept beside it.</span>
            </div>
        </div>
    );
}

function ReviewStep({ imp, onChange }) {
    const [status, setStatus] = useState("");
    const [search, setSearch] = useState("");
    const [debounced, setDebounced] = useState("");
    const [pageSize, setPageSize] = useState(50);
    const [page, setPage] = useState(0);
    const [editing, setEditing] = useState(null);
    const [refresh, setRefresh] = useState(0);
    useEffect(() => { const t = setTimeout(() => setDebounced(search.trim()), 300); return () => clearTimeout(t); }, [search]);
    useEffect(() => setPage(0), [status, debounced, pageSize]);
    const fetchPage = useCallback((limit, offset) => listSalesImportRows(imp.id, { limit, offset, status: status || undefined, search: debounced || undefined }), [imp.id, status, debounced]);
    const { rows, total, loadingMore, loadMoreFailed, hasMore, loadMore } = usePagedRows({ fetchPage, pageSize, page, refreshKey: `${refresh}-${imp.selected}-${imp.counts.READY}` });
    const all = isAll(pageSize);
    const totalPages = all ? 1 : Math.max(1, Math.ceil(total / pageSize));
    const reload = async () => { setRefresh((k) => k + 1); onChange(await getSalesImport(imp.id)); };
    const decide = async (decision, extra) => {
        try {
            onChange(await setSalesImportDecision(imp.id, { decision, ...extra }));
            setRefresh((k) => k + 1);
        } catch (e) {
            toast.error(msg(e, "Failed to update rows"));
        }
    };

    return (
        <section aria-label="Review rows" className="space-y-3 rounded-2xl border border-white/10 bg-black/25 p-4">
            <div className="flex flex-wrap gap-1.5">
                {[["", `All ${imp.total_rows}`], ["PROBLEMS", `Problems ${imp.total_rows - imp.counts.READY}`],
                    ...Object.keys(STATUS).filter((s) => imp.counts[s]).map((s) => [s, `${STATUS[s].label} ${imp.counts[s]}`])].map(([id, label]) => (
                    <button key={id || "all"} type="button" onClick={() => setStatus(id)} aria-pressed={status === id}
                        className={`h-8 rounded-xl border px-3 text-[11px] font-bold uppercase tracking-wider ${status === id ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300" : "border-white/10 text-white/50"}`}>
                        {label}
                    </button>
                ))}
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search rows" aria-label="Search rows"
                    className="ml-auto h-8 w-44 rounded-xl border border-white/10 bg-white/5 px-3 text-xs text-white" />
            </div>
            {INCLUDABLE.includes(status) && imp.counts[status] > 0 && (
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/60">
                    <button type="button" className={`${small} border-white/15 text-white/80`} onClick={() => decide("INCLUDE", { status })}>Include all {STATUS[status].label.toLowerCase()} rows</button>
                    <button type="button" className={`${small} border-white/15 text-white/80`} onClick={() => decide("AUTO", { status })}>Back to excluded</button>
                    <span>{status === "DUPLICATE" ? "Only if they are separate, real sales." : "Only once you've checked them."}</span>
                </div>
            )}
            {rows === null ? (
                <div className="flex items-center gap-2 text-sm text-white/50"><Loader2 className="h-4 w-4 animate-spin" /> Loading rows…</div>
            ) : !rows.length ? (
                <p className="text-xs text-white/45">No rows here.</p>
            ) : (
                <div className="max-h-[60vh] overflow-auto rounded-xl border border-white/10">
                    <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-black/70">
                            <tr>{["Import", "Row", "Vehicle", "Converter", "Qty", "Unit price", "Date", "Buyer", "Status", ""].map((h) => <th key={h} className="px-2 py-2 text-left font-bold uppercase tracking-wider text-white/50 whitespace-nowrap">{h}</th>)}</tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => (
                                <React.Fragment key={r.id}>
                                    <tr className="odd:bg-white/[0.02] align-top">
                                        <td className="px-2 py-1.5">
                                            <input type="checkbox" aria-label={`Import row ${r.row_number}`} className="h-4 w-4" checked={r.will_import}
                                                disabled={!["READY", ...INCLUDABLE].includes(r.status)}
                                                onChange={(e) => decide(e.target.checked ? (r.status === "READY" ? "AUTO" : "INCLUDE") : "EXCLUDE", { rowIds: [r.id] })} />
                                        </td>
                                        <td className="px-2 py-1.5 text-white/45">{r.row_number}</td>
                                        <td className="px-2 py-1.5 text-white/75 whitespace-nowrap">{[r.values.year, r.values.make, r.values.model].filter(Boolean).join(" ") || r.values.vehicle_description || "—"}{r.values.vin && <div className="font-mono text-[10px] text-white/40">{r.values.vin}</div>}</td>
                                        <td className="px-2 py-1.5 font-mono text-white/85">{r.values.converter_code || "—"}</td>
                                        <td className="px-2 py-1.5 text-white/70">{r.values.quantity}</td>
                                        <td className="px-2 py-1.5 text-white/85 whitespace-nowrap">{r.values.unit_price ? `${r.values.unit_price} ${r.values.currency || ""}` : "—"}</td>
                                        <td className="px-2 py-1.5 text-white/70 whitespace-nowrap">{r.values.sale_date || "—"}</td>
                                        <td className="max-w-[140px] truncate px-2 py-1.5 text-white/60">{r.values.buyer || "—"}</td>
                                        <td className="max-w-[260px] px-2 py-1.5"><Pill status={r.status} />{r.messages[0] && <div className="mt-0.5 text-[10px] text-white/50">{r.messages.join("; ")}</div>}</td>
                                        <td className="px-2 py-1.5"><button type="button" className="text-[11px] text-white/60 underline" onClick={() => setEditing(editing === r.id ? null : r.id)}>Edit</button></td>
                                    </tr>
                                    {editing === r.id && (
                                        <tr><td colSpan={10} className="px-2 pb-2"><RowEditor row={r} importId={imp.id} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} /></td></tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                    <LoadMoreRows hasMore={hasMore} loading={loadingMore} failed={loadMoreFailed} onLoadMore={loadMore} loadedCount={rows.length} />
                </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-white/40">
                <span>{showingLabel({ pageSize, page, shown: rows?.length || 0, total, noun: "row" })}</span>
                <div className="flex items-center gap-2">
                    <PageSizeSelect value={pageSize} onChange={setPageSize} />
                    {!all && <>
                        <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className={`${small} border-white/10 text-white/70`}>Prev</button>
                        <button type="button" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)} className={`${small} border-white/10 text-white/70`}>Next</button>
                    </>}
                </div>
            </div>
        </section>
    );
}

export default function SalesImport({ onImported }) {
    const [imp, setImp] = useState(null);
    const [history, setHistory] = useState([]);
    const [samples, setSamples] = useState({});
    const [busy, setBusy] = useState("");
    const [confirming, setConfirming] = useState(false);
    const [result, setResult] = useState(null);

    const loadHistory = useCallback(() => listSalesImports().then(setHistory).catch(() => setHistory([])), []);
    useEffect(() => { loadHistory(); }, [loadHistory]);
    useEffect(() => {
        if (!imp) return;
        listSalesImportRows(imp.id, { limit: 3 }).then((d) => {
            const first = {};
            for (const row of d.items) for (const [k, v] of Object.entries(row.raw)) if (v && !first[k]) first[k] = String(v);
            setSamples(first);
        }).catch(() => setSamples({}));
    }, [imp?.id, imp?.header_row, imp?.sheet_name]); // eslint-disable-line react-hooks/exhaustive-deps

    const upload = async (file) => {
        if (!file) return;
        setBusy("upload");
        setResult(null);
        try {
            setImp(await uploadSalesFile(file));
            loadHistory();
        } catch (e) {
            toast.error(msg(e, "Failed to read the file"));
        } finally {
            setBusy("");
        }
    };

    const commit = async () => {
        setBusy("commit");
        try {
            const done = await commitSalesImport(imp.id);
            setResult(done);
            setImp(null);
            setConfirming(false);
            toast.success(`${done.newly_imported} sale${done.newly_imported === 1 ? "" : "s"} imported`);
            loadHistory();
            onImported?.();
        } catch (e) {
            toast.error(msg(e, "Import failed; nothing was saved"));
        } finally {
            setBusy("");
        }
    };

    const summary = useMemo(() => imp && [
        ["Total rows", imp.total_rows], ["Ready", imp.counts.READY], ["Duplicates", imp.counts.DUPLICATE],
        ["Invalid", imp.counts.INVALID + imp.counts.MISSING_REQUIRED], ["Need review", imp.counts.REQUIRES_REVIEW + imp.counts.AMBIGUOUS],
        ["Not sales", imp.counts.NOT_A_SALE], ["Selected", imp.selected],
    ], [imp]);

    return (
        <div className="space-y-4">
            {!imp && (
                <div className="space-y-3 rounded-2xl border border-dashed border-white/15 p-4">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-black">
                        {busy === "upload" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Choose a CSV, XLSX or XLS file
                        <input type="file" accept=".csv,.txt,.tsv,.xlsx,.xls" className="sr-only" aria-label="Sales file" onChange={(e) => upload(e.target.files?.[0])} />
                    </label>
                    <p className="text-[11px] text-white/40">Up to 10 MB and 20,000 rows. Any column names or order: the columns are matched for you to check, and nothing is saved until you confirm.</p>
                    {result && <p role="status" className="text-xs text-emerald-200">Import #{result.id}: {result.newly_imported} sale{result.newly_imported === 1 ? "" : "s"} added. Our Database uses them for every vehicle whose catalog lists the converter; stored vehicle prices change only when Catalytic Analysis runs again.</p>}
                    {history.length > 0 && (
                        <div className="text-[11px] text-white/50">
                            <div className="mb-1 font-bold uppercase tracking-wider text-white/35">Recent imports</div>
                            <ul className="space-y-1">
                                {history.slice(0, 8).map((h) => (
                                    <li key={h.id} className="flex flex-wrap justify-between gap-x-3">
                                        <span>#{h.id} {h.filename} · {h.status === "COMMITTED" ? `${h.imported_rows} of ${h.total_rows} imported` : h.status.toLowerCase()}</span>
                                        {h.status === "MAPPING" && <button type="button" className="underline" onClick={async () => setImp(await getSalesImport(h.id))}>Continue</button>}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
            {imp && (
                <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-bold text-white/85">{imp.filename}<span className="ml-2 text-xs font-normal text-white/40">import #{imp.id}</span></div>
                        <button type="button" className={`${small} border-white/15 text-white/70`} onClick={async () => { await discardSalesImport(imp.id).catch(() => null); setImp(null); loadHistory(); }}>Discard</button>
                    </div>
                    <MappingStep imp={imp} onChange={setImp} samples={samples} />
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-7">
                        {summary.map(([label, value]) => (
                            <div key={label} className="rounded-xl border border-white/10 bg-black/25 p-2 text-center">
                                <div className="text-base font-black text-white/90">{value}</div>
                                <div className="text-[10px] font-bold uppercase tracking-wider text-white/40">{label}</div>
                            </div>
                        ))}
                    </div>
                    <ReviewStep imp={imp} onChange={setImp} />
                    <div className="flex flex-wrap items-center gap-3">
                        <button type="button" disabled={!imp.selected || imp.mapping_problems.length > 0 || Boolean(busy)} onClick={() => setConfirming(true)}
                            className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-500 px-4 text-xs font-bold text-black disabled:opacity-40">
                            Import Approved Sales ({imp.selected})
                        </button>
                        {imp.mapping_problems.length > 0 && <span className="text-[11px] text-amber-200/90">Finish the mapping first.</span>}
                    </div>
                </>
            )}
            {confirming && imp && (
                <ConfirmDialog
                    action={{
                        title: `Import ${imp.selected} sale${imp.selected === 1 ? "" : "s"}?`,
                        body: `They're added to the sales ledger in one step, and Our Database prices from them from now on. ${imp.total_rows - imp.selected} row${imp.total_rows - imp.selected === 1 ? "" : "s"} stay out. No stored vehicle price changes until Catalytic Analysis runs again.`,
                        confirm: "Import Approved Sales",
                    }}
                    busy={busy === "commit"}
                    onConfirm={commit}
                    onClose={() => setConfirming(false)}
                />
            )}
        </div>
    );
}
