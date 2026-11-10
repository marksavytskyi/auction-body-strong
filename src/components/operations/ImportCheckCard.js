"use client";

import React, { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, Loader2 } from "lucide-react";

import { getImport, listVehicles } from "@/lib/catalytic/copartImport";
import { CatalyticApiError } from "@/lib/catalytic/http";

// Phase K.51: what the removed CATS Copart Imports page showed and Operations didn't —
// how the uploaded file checked out, row by row. The same import record the batch was
// made from, so nothing is uploaded or counted twice. Reads only.
const PAGE = 1000;

export default function ImportCheckCard({ copartImportId }) {
    const [open, setOpen] = useState(false);
    const [summary, setSummary] = useState(null);
    const [problems, setProblems] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!copartImportId) return;
        getImport(copartImportId).then(setSummary).catch((e) => setError(e instanceof CatalyticApiError ? e.message : "Failed to load the import check"));
    }, [copartImportId]);

    const loadProblems = useCallback(async () => {
        try {
            const found = [];
            for (let offset = 0; offset < (summary?.total_rows || 0); offset += PAGE) {
                const page = await listVehicles(copartImportId, { limit: PAGE, offset });
                const rows = Array.isArray(page) ? page : [];
                found.push(...rows.filter((v) => !v.row_valid || v.vin_state === "MASKED" || v.vin_state === "INVALID"));
                if (rows.length < PAGE) break;
            }
            setProblems(found);
        } catch (e) {
            setError(e instanceof CatalyticApiError ? e.message : "Failed to load the rows");
        }
    }, [copartImportId, summary?.total_rows]);

    useEffect(() => { if (open && summary && problems === null) loadProblems(); }, [open, summary, problems, loadProblems]);

    if (!copartImportId || (!summary && !error)) return null;
    const flagged = summary ? summary.invalid_rows + summary.masked_vin_rows : 0;
    return (
        <section aria-label="Import check" className="rounded-2xl border border-white/10 bg-white/[0.02]">
            <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="flex min-h-11 w-full items-center gap-2 px-4 text-left text-sm font-bold text-white/80">
                {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                Import check
                {summary && (
                    <span className={`text-xs font-normal ${flagged ? "text-amber-300" : "text-white/45"}`}>
                        {summary.valid_rows} of {summary.total_rows} rows valid{flagged ? ` · ${summary.invalid_rows} invalid · ${summary.masked_vin_rows} masked VINs` : ""}
                    </span>
                )}
            </button>
            {open && (
                <div className="space-y-3 px-4 pb-4 text-xs">
                    {error && <p className="text-rose-300">{error}</p>}
                    {summary && (
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
                            {[
                                ["Rows", summary.total_rows], ["Valid", summary.valid_rows], ["Invalid", summary.invalid_rows],
                                ["Repeated lots", summary.duplicate_rows], ["Full VINs", summary.full_vin_rows], ["Masked VINs", summary.masked_vin_rows],
                            ].map(([label, value]) => (
                                <div key={label} className="rounded-xl border border-white/10 bg-black/25 p-2.5 text-center">
                                    <div className="text-base font-black text-white/90">{value}</div>
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-white/40">{label}</div>
                                </div>
                            ))}
                        </div>
                    )}
                    <p className="text-[11px] text-white/40">
                        From {summary?.filename || "the uploaded file"}. A masked VIN can&apos;t be searched in CatDB; an invalid row has no vehicle data to analyze.
                    </p>
                    {problems === null ? (
                        <div className="flex items-center gap-2 text-white/50"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading rows…</div>
                    ) : problems.length === 0 ? (
                        <p className="text-white/50">Every row checked out.</p>
                    ) : (
                        <div className="overflow-x-auto rounded-xl border border-white/10">
                            <table className="w-full">
                                <thead className="bg-black/40">
                                    <tr>{["Row", "Lot", "VIN", "Problem"].map((h) => <th key={h} className="px-3 py-2 text-left font-bold uppercase tracking-wider text-white/50">{h}</th>)}</tr>
                                </thead>
                                <tbody>
                                    {problems.map((v) => (
                                        <tr key={v.id} className="odd:bg-white/[0.02]">
                                            <td className="px-3 py-1.5 text-white/60">{v.source_row_number}</td>
                                            <td className="px-3 py-1.5 text-white/70">{v.lot_number || "—"}</td>
                                            <td className="px-3 py-1.5 font-mono text-white/60">{v.source_vin || "—"}</td>
                                            <td className="px-3 py-1.5 text-amber-200/90">
                                                <span className="inline-flex items-center gap-1.5"><AlertTriangle className="h-3 w-3 shrink-0" />
                                                    {!v.row_valid ? (v.validation_error || "Invalid row")
                                                        : v.vin_state === "MASKED" ? "Masked VIN: not searchable in CatDB" : "Not a valid VIN: not searchable in CatDB"}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}
