"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, AlertTriangle, History, ChevronLeft, ChevronRight } from "lucide-react";

import { listOperationsCatdbApprovals } from "@/lib/operations/api";
import { CatalyticApiError } from "@/lib/catalytic/http";
import { formatDate } from "@/lib/operations/format";
import { CATDB_APPROVAL_STATUS_LABEL, CATDB_APPROVAL_STATUS_TONE } from "@/lib/operations/constants";
import StatusPill from "@/components/catalytic/StatusPill";

const PAGE_SIZE = 10;

// Read-only — GET .../catdb/approvals never resumes, completes, or
// otherwise changes any approval row (see
// app.operations.catdb_approval.list_approvals's own docstring). Every
// field rendered here is a real CatDBApprovalResponse field; no counts
// or statuses are invented or inferred client-side. The new/reused/
// active/blocked/ineligible/quota-exhausted counts are shown
// individually rather than summed into one invented "total" figure.
export default function CatdbApprovalHistory({ batchId, refreshKey }) {
    const [page, setPage] = useState(0);
    const [items, setItems] = useState(null);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const data = await listOperationsCatdbApprovals(batchId, { limit: PAGE_SIZE, offset: page * PAGE_SIZE });
            setItems(Array.isArray(data?.items) ? data.items : []);
            setTotal(data?.total ?? 0);
        } catch (e) {
            setError(e instanceof CatalyticApiError ? e.message : "Failed to load CatDB approval history");
            setItems(null);
        } finally {
            setLoading(false);
        }
    }, [batchId, page]);

    useEffect(() => { load(); }, [load, refreshKey]);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/40 font-bold">
                <History className="h-3 w-3" /> Approval History
            </div>

            {loading ? (
                <div className="flex items-center gap-2 text-white/50 text-sm py-6 justify-center">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading approval history…
                </div>
            ) : error ? (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2"><AlertTriangle className="h-4 w-4 shrink-0" /> {error}</span>
                    <button type="button" onClick={load} className="underline shrink-0">Retry</button>
                </div>
            ) : !items || items.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/25 p-6 text-center text-xs text-white/40">
                    No CatDB approvals have been submitted for this batch yet.
                </div>
            ) : (
                <>
                    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/25">
                        <table className="w-full text-xs">
                            <thead className="bg-black/40">
                                <tr>
                                    {["ID", "Created", "Status", "Requested Max", "New", "Reused", "Active", "Blocked", "Ineligible", "Quota Exhausted"].map((h) => (
                                        <th key={h} className="px-3 py-2 text-left uppercase tracking-wider text-white/50 font-bold border-b border-white/10 whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((a) => (
                                    <tr key={a.id} className="odd:bg-white/[0.02]">
                                        <td className="px-3 py-2 border-b border-white/5 text-white/60 whitespace-nowrap">#{a.id}</td>
                                        <td className="px-3 py-2 border-b border-white/5 text-white/60 whitespace-nowrap">{formatDate(a.created_at)}</td>
                                        <td className="px-3 py-2 border-b border-white/5 whitespace-nowrap">
                                            <div className="flex items-center gap-1.5">
                                                <StatusPill
                                                    label={CATDB_APPROVAL_STATUS_LABEL[a.status] || a.status}
                                                    tone={CATDB_APPROVAL_STATUS_TONE[a.status] || "neutral"}
                                                />
                                                {a.needs_reconciliation && (
                                                    <span title="Needs reconciliation"><AlertTriangle className="h-3 w-3 text-amber-300" /></span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 border-b border-white/5 text-white/70 whitespace-nowrap">{a.requested_max_new_searches}</td>
                                        <td className="px-3 py-2 border-b border-white/5 text-white/70 whitespace-nowrap">{a.new_search_count}</td>
                                        <td className="px-3 py-2 border-b border-white/5 text-white/70 whitespace-nowrap">{a.reused_completed_count}</td>
                                        <td className="px-3 py-2 border-b border-white/5 text-white/70 whitespace-nowrap">{a.attached_active_job_count}</td>
                                        <td className="px-3 py-2 border-b border-white/5 text-white/70 whitespace-nowrap">{a.blocked_count}</td>
                                        <td className="px-3 py-2 border-b border-white/5 text-white/70 whitespace-nowrap">{a.ineligible_count}</td>
                                        <td className="px-3 py-2 border-b border-white/5 text-white/70 whitespace-nowrap">{a.quota_exhausted_count}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex items-center justify-between gap-3 text-xs text-white/40">
                        <span>{total} approval{total === 1 ? "" : "s"} · page {page + 1} of {totalPages}</span>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                disabled={page === 0}
                                onClick={() => setPage((p) => Math.max(0, p - 1))}
                                className="p-1.5 rounded-lg border border-white/10 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <button
                                type="button"
                                disabled={page + 1 >= totalPages}
                                onClick={() => setPage((p) => p + 1)}
                                className="p-1.5 rounded-lg border border-white/10 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
