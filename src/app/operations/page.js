"use client";

import React, { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Boxes, ArrowRight, RefreshCw, AlertTriangle, Settings2, ChevronLeft, ChevronRight } from "lucide-react";

import { listOperationsBatches } from "@/lib/operations/api";
import { CatalyticApiError } from "@/lib/catalytic/http";
import { BATCH_STATUS_TONE } from "@/lib/operations/constants";
import { formatDate } from "@/lib/operations/format";
import StatusPill from "@/components/catalytic/StatusPill";
import PageSizeSelect from "@/components/ui/PageSizeSelect";
import LoadMoreRows from "@/components/ui/LoadMoreRows";
import usePageSize from "@/hooks/usePageSize";
import usePagedRows from "@/hooks/usePagedRows";
import { isAll, showingLabel } from "@/lib/pagination";
import dynamic from "next/dynamic";

import ScrapPriceControl from "@/components/operations/ScrapPriceControl";

// Holds the file-drop library; the batch list shouldn't wait for it.
const UploadBatchFlow = dynamic(() => import("@/components/operations/UploadBatchFlow"), {
    ssr: false,
    loading: () => <div className="h-28 rounded-2xl border border-dashed border-white/10" />,
});

function BatchRow({ batch }) {
    return (
        <Link
            href={`/operations/${batch.id}`}
            className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3.5 hover:bg-white/[0.05] hover:border-white/20 transition-colors sm:flex-row sm:items-center sm:justify-between"
        >
            <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 shrink-0">
                    <Boxes className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="min-w-0">
                    <div className="text-sm font-bold text-white/90 truncate">Batch #{batch.id}</div>
                    <div className="text-[11px] text-white/40">{formatDate(batch.created_at)} · {batch.created_by_email}</div>
                </div>
            </div>

            <div className="flex items-center gap-4 flex-wrap text-xs">
                <StatusPill label={batch.status} tone={BATCH_STATUS_TONE[batch.status] || "neutral"} />
                <span className="text-white/60"><b className="text-white/90">{batch.total_vehicles ?? 0}</b> vehicles</span>
                {batch.parts_job_status && (
                    <span className="text-white/40">Parts: {batch.parts_job_status}</span>
                )}
                <ArrowRight className="h-3.5 w-3.5 text-white/30" />
            </div>
        </Link>
    );
}

export default function OperationsOverviewPage() {
    const router = useRouter();
    const [page, setPage] = useState(0);
    // 50 was the fixed number shown before; batches beyond it weren't reachable at all.
    const [pageSize, setPageSize] = usePageSize("operations:batches:page-size", 50);
    const fetchPage = useCallback((limit, offset) => listOperationsBatches({ limit, offset }), []);
    const { rows: batches, total, loading: listLoading, loadingMore, loadMoreFailed, error: loadError, hasMore, loadMore, reload } = usePagedRows({ fetchPage, pageSize, page });
    // Keeps the list on screen while Refresh reloads it.
    const loading = listLoading && !batches;
    const error = loadError ? (loadError instanceof CatalyticApiError ? loadError.message : "Failed to load Operations batches") : "";
    const load = () => reload({ keep: true });
    const all = isAll(pageSize);
    const totalPages = all ? 1 : Math.max(1, Math.ceil(total / pageSize));
    const changePageSize = (next) => {
        setPage(0);
        setPageSize(next);
    };

    return (
        <div className="space-y-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-xl font-black uppercase tracking-tight text-white/90 inline-flex items-center gap-2">
                        <Boxes className="h-5 w-5 text-emerald-400" /> Operations
                    </h1>
                    <p className="text-xs text-white/40 mt-1">Upload a Copart CSV to create a batch, then run vehicle analysis.</p>
                </div>
                <div className="flex items-center gap-1 self-start">
                    <Link
                        href="/operations/settings/catdb"
                        className="inline-flex items-center gap-1.5 px-3 h-9 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs font-bold uppercase tracking-wide"
                    >
                        <Settings2 className="h-3.5 w-3.5" /> CatDB Devices &amp; Subscriptions
                    </Link>
                    <button type="button" onClick={load} className="p-2 rounded-xl hover:bg-white/10 text-white/40 hover:text-white" title="Refresh">
                        <RefreshCw className="h-4 w-4" />
                    </button>
                </div>
            </div>

            <ScrapPriceControl />

            <UploadBatchFlow onUploaded={(batch) => router.push(`/operations/${batch.id}`)} />

            {loading ? (
                <div className="flex items-center gap-2 text-white/50 text-sm py-12 justify-center">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </div>
            ) : error ? (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2"><AlertTriangle className="h-4 w-4 shrink-0" /> {error}</span>
                    <button type="button" onClick={load} className="underline shrink-0">Retry</button>
                </div>
            ) : !batches || batches.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/25 p-10 text-center">
                    <Boxes className="h-8 w-8 text-white/20 mx-auto mb-3" />
                    <div className="text-sm text-white/50 font-medium">No Operations batches yet.</div>
                    <div className="text-xs text-white/35 mt-1">Upload a Copart CSV above to get started.</div>
                </div>
            ) : (
                <div className="space-y-2">
                    {batches.map((b) => (
                        <BatchRow key={b.id} batch={b} />
                    ))}
                    <LoadMoreRows hasMore={hasMore} loading={loadingMore} failed={loadMoreFailed} onLoadMore={loadMore} loadedCount={batches.length} />
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs text-white/40">
                        <span>
                            {showingLabel({ pageSize, page, shown: batches.length, total, noun: "batch", plural: "batches" })}
                            {!all && totalPages > 1 && <> · page {page + 1} of {totalPages}</>}
                        </span>
                        <div className="flex items-center gap-2">
                            <PageSizeSelect value={pageSize} onChange={changePageSize} />
                            {!all && (
                                <>
                                    <button
                                        type="button"
                                        disabled={page === 0}
                                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                                        aria-label="Previous page"
                                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed sm:h-8 sm:w-8"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </button>
                                    <button
                                        type="button"
                                        disabled={page + 1 >= totalPages}
                                        onClick={() => setPage((p) => p + 1)}
                                        aria-label="Next page"
                                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed sm:h-8 sm:w-8"
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
