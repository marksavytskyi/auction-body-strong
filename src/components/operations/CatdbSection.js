"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { AlertTriangle, Search, RefreshCw, Info, ShieldOff, ChevronDown, ChevronUp } from "lucide-react";

import { previewOperationsCatdbSearches, reconcileOperationsCatdbResults } from "@/lib/operations/api";
import { CatalyticApiError } from "@/lib/catalytic/http";
import { formatDate } from "@/lib/operations/format";
import {
    CATDB_VIN_CATEGORY, CATDB_VIN_CATEGORY_LABEL, CATDB_VIN_CATEGORY_TONE,
    CATDB_QUOTA_RECONCILIATION_STATUS, CATDB_APPROVAL_STATUS,
    OPERATIONS_CATDB_DISABLED_ERROR_CODE,
} from "@/lib/operations/constants";
import { Button } from "@/components/ui/button";
import StatusPill from "@/components/catalytic/StatusPill";
import CatdbApprovalDialog from "./CatdbApprovalDialog";
import CatdbApprovalHistory from "./CatdbApprovalHistory";

function CountCell({ label, value, tone }) {
    const toneClass = {
        neutral: "text-white/70",
        success: "text-emerald-300",
        info: "text-sky-300",
        progress: "text-violet-300",
        warning: "text-amber-300",
        danger: "text-rose-300",
    }[tone || "neutral"];
    return (
        <div className="text-center">
            <div className={`text-lg font-black ${toneClass}`}>{value ?? 0}</div>
            <div className="text-[9px] uppercase tracking-wider text-white/40 font-bold mt-0.5">{label}</div>
        </div>
    );
}

const ENTRY_DETAIL_CATEGORIES = new Set([CATDB_VIN_CATEGORY.UNCERTAIN_SUBMISSION, CATDB_VIN_CATEGORY.INELIGIBLE]);
const ENTRY_DETAIL_LIMIT = 50;

// Dedicated, visually separate section for CatDB's PAID VIN search
// process — never to be confused with Our Database (the free local
// catalytic-converter lookup table rendered elsewhere on this page).
// No action here can ever start a search by itself: preview is strictly
// read-only (GET), and approval only ever happens through
// CatdbApprovalDialog's own explicit confirm step. Reconciliation here
// only ever reads back the current state of already-existing CatDBJobs
// — see reconcileOperationsCatdbResults's own docstring.
export default function CatdbSection({ batchId, refreshKey, onBatchDataChanged }) {
    const [preview, setPreview] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState("");
    const [previewErrorStatus, setPreviewErrorStatus] = useState(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [showDetails, setShowDetails] = useState(false);
    const [approvalRefreshKey, setApprovalRefreshKey] = useState(0);
    const [reconcileBusy, setReconcileBusy] = useState(false);
    const [hasActiveApproval, setHasActiveApproval] = useState(false);
    const previousPageRefreshKeyRef = useRef(refreshKey);

    const handleApprovalsLoaded = useCallback((items) => {
        setHasActiveApproval(
            (items || []).some(
                (a) => a.status === CATDB_APPROVAL_STATUS.PREPARING || a.status === CATDB_APPROVAL_STATUS.IN_PROGRESS
            )
        );
    }, []);

    // Phase H/I-B: piggybacks on the page's OWN existing poll tick
    // (refreshKey, bumped every 5s while the batch is PROCESSING — see
    // src/app/operations/[id]/page.js) to keep approval history in sync
    // while an approval is still actively being worked on
    // (PREPARING/IN_PROGRESS) — never a second polling interval, never
    // an automatic reconcile/preview/approve/retry call, only the
    // existing read-only GET .../catdb/approvals.
    //
    // Deliberately does NOT keep refreshing just because an approval
    // sits in NEEDS_RECONCILIATION: that status never resolves on its
    // own (app.operations.catdb_approval's own docstring: "Deliberately
    // never auto-retried... A human... must look at this row directly")
    // and the manual "Refresh CatDB Results" reconcile action only ever
    // touches vehicle rows, never the approval row itself — polling a
    // row that cannot change without a brand-new approval or a future
    // dedicated reconciliation phase would be pure waste. Once no
    // approval is PREPARING/IN_PROGRESS, further page poll ticks are
    // simply ignored here (no request fires) until the next explicit
    // approve/reconcile action bumps approvalRefreshKey directly.
    useEffect(() => {
        if (refreshKey === previousPageRefreshKeyRef.current) return;
        previousPageRefreshKeyRef.current = refreshKey;
        if (hasActiveApproval) {
            setApprovalRefreshKey((k) => k + 1);
        }
    }, [refreshKey, hasActiveApproval]);

    const loadPreview = async () => {
        setPreviewLoading(true);
        setPreviewError("");
        setPreviewErrorStatus(null);
        try {
            const data = await previewOperationsCatdbSearches(batchId);
            setPreview(data);
        } catch (e) {
            setPreview(null);
            setPreviewError(e instanceof CatalyticApiError ? e.message : "Failed to load CatDB preview");
            setPreviewErrorStatus(e instanceof CatalyticApiError ? e.status : null);
        } finally {
            setPreviewLoading(false);
        }
    };

    const handleApproved = () => {
        setDialogOpen(false);
        // The approval just consumed this exact preview snapshot — never
        // reusable for a second approval. Force a fresh preview before
        // the admin can approve anything else.
        setPreview(null);
        setApprovalRefreshKey((k) => k + 1);
        onBatchDataChanged?.();
    };

    const handleStalePreview = () => {
        // 409 from the backend (stale fingerprint or a conflicting
        // in-flight decision for this exact fingerprint) — the only safe
        // path forward is a brand-new preview, never a silent retry with
        // the same or an adjusted number.
        setPreview(null);
    };

    const handleReconcile = async () => {
        setReconcileBusy(true);
        try {
            const summary = await reconcileOperationsCatdbResults(batchId);
            toast.success(
                `Reconciled ${summary.vehicles_examined} vehicle(s): ${summary.done_count} done, `
                + `${summary.no_result_count} no data, ${summary.review_required_count} need review, `
                + `${summary.still_in_flight_count} still in flight`
            );
            setApprovalRefreshKey((k) => k + 1);
            onBatchDataChanged?.();
        } catch (e) {
            toast.error(e instanceof CatalyticApiError ? e.message : "Failed to reconcile CatDB results");
        } finally {
            setReconcileBusy(false);
        }
    };

    // preview.entries is a plain JSON array (CatDBPreviewResponse.entries
    // — see app/operations/catdb_approval_schemas.py), never a dict —
    // Phase H audit finding L1.
    const detailEntries = preview
        ? (preview.entries || []).filter((e) => ENTRY_DETAIL_CATEGORIES.has(e.category))
        : [];

    return (
        <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.03] p-4 space-y-4">
            <div>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-white/90">CatDB Paid VIN Searches</h3>
                    <Button size="sm" variant="outline" className="rounded-xl" onClick={handleReconcile} isLoading={reconcileBusy} disabled={reconcileBusy}>
                        {!reconcileBusy && <RefreshCw className="h-3.5 w-3.5" />} Refresh CatDB Results
                    </Button>
                </div>
                <div className="mt-2 rounded-xl border border-sky-500/20 bg-sky-500/[0.04] p-3 text-[11px] text-sky-200/70 inline-flex items-start gap-2">
                    <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    This is a separate, paid subscription-backed search process — distinct from Our Database (the free local
                    lookup above). No search is ever started automatically; every new paid search requires explicit approval below.
                </div>
            </div>

            <div>
                <Button size="sm" className="rounded-xl" onClick={loadPreview} isLoading={previewLoading} disabled={previewLoading}>
                    {!previewLoading && <Search className="h-3.5 w-3.5" />} Preview CatDB Searches
                </Button>
            </div>

            {previewError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium flex items-start gap-2">
                    {previewErrorStatus === 503 ? <ShieldOff className="h-4 w-4 shrink-0 mt-0.5" /> : <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />}
                    <span>
                        {previewErrorStatus === 503 && previewError.startsWith(OPERATIONS_CATDB_DISABLED_ERROR_CODE) ? (
                            <>
                                <strong>CatDB paid search is not enabled on this server.</strong> Ask an administrator to enable it before previewing or approving new searches.
                            </>
                        ) : previewErrorStatus === 503 ? (
                            <>
                                <strong>Quota status unknown — blocked.</strong> {previewError}
                            </>
                        ) : previewError}
                    </span>
                </div>
            )}

            {preview && (
                <div className="space-y-3">
                    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                            <CountCell label="Total Vehicles" value={preview.total_operations_rows} />
                            <CountCell label="New Search Needed" value={preview.never_searched_count} tone={CATDB_VIN_CATEGORY_TONE[CATDB_VIN_CATEGORY.NEVER_SEARCHED]} />
                            <CountCell label="Reusable" value={preview.reusable_count} tone={CATDB_VIN_CATEGORY_TONE[CATDB_VIN_CATEGORY.COMPLETED_REUSABLE]} />
                            <CountCell label="Active Existing" value={preview.active_existing_job_count} tone={CATDB_VIN_CATEGORY_TONE[CATDB_VIN_CATEGORY.ACTIVE_EXISTING_JOB]} />
                            <CountCell label="Uncertain" value={preview.uncertain_count} tone={CATDB_VIN_CATEGORY_TONE[CATDB_VIN_CATEGORY.UNCERTAIN_SUBMISSION]} />
                            <CountCell label="No Data" value={preview.conclusive_no_data_count} tone={CATDB_VIN_CATEGORY_TONE[CATDB_VIN_CATEGORY.CONCLUSIVE_NO_DATA]} />
                        </div>
                    </div>

                    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-4">
                        <div className="text-[10px] uppercase tracking-wider text-amber-300/80 font-bold mb-2">Quota Impact</div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <CountCell label="Available This Period" value={preview.available_quota} tone="info" />
                            <CountCell label="Quota-Capped Max" value={preview.max_approvable_new_searches} tone="warning" />
                            <CountCell label="Blocked / Ineligible" value={preview.ineligible_count} tone="danger" />
                            <div className="text-center">
                                <StatusPill
                                    label={preview.quota_reconciliation_status === CATDB_QUOTA_RECONCILIATION_STATUS.RECONCILED ? "Reconciled" : "Pending"}
                                    tone={preview.quota_reconciliation_status === CATDB_QUOTA_RECONCILIATION_STATUS.RECONCILED ? "success" : "warning"}
                                />
                                <div className="text-[9px] uppercase tracking-wider text-white/40 font-bold mt-1">Period {preview.quota_period_key}</div>
                            </div>
                        </div>
                        <div className="text-[11px] text-white/40 mt-2">
                            Generated {formatDate(preview.generated_at)} · fingerprint <span className="font-mono text-white/30">{preview.fingerprint.slice(0, 12)}…</span>
                        </div>
                    </div>

                    {detailEntries.length > 0 && (
                        <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                            <button
                                type="button"
                                onClick={() => setShowDetails((s) => !s)}
                                className="flex items-center justify-between w-full text-[11px] uppercase tracking-wider text-white/40 font-bold"
                            >
                                <span>Uncertain / Blocked VINs ({detailEntries.length})</span>
                                {showDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            </button>
                            {showDetails && (
                                <ul className="mt-3 space-y-1.5 text-xs">
                                    {detailEntries.slice(0, ENTRY_DETAIL_LIMIT).map((e, i) => (
                                        <li key={`${e.vin || "row"}-${i}`} className="flex items-start gap-2">
                                            <StatusPill label={CATDB_VIN_CATEGORY_LABEL[e.category] || e.category} tone={CATDB_VIN_CATEGORY_TONE[e.category] || "neutral"} />
                                            <span className="text-white/50 font-mono">{e.vin || "(no VIN)"}</span>
                                            <span className="text-white/35">{e.reason}</span>
                                        </li>
                                    ))}
                                    {detailEntries.length > ENTRY_DETAIL_LIMIT && (
                                        <li className="text-white/30">+{detailEntries.length - ENTRY_DETAIL_LIMIT} more not shown</li>
                                    )}
                                </ul>
                            )}
                        </div>
                    )}

                    <div className="flex items-center gap-3 flex-wrap">
                        <Button
                            size="sm"
                            className="rounded-xl"
                            onClick={() => setDialogOpen(true)}
                            disabled={preview.max_approvable_new_searches <= 0}
                        >
                            Approve New Searches
                        </Button>
                        {preview.max_approvable_new_searches <= 0 && (
                            <span className="text-[11px] text-white/35">
                                No quota-eligible new searches available this period.
                            </span>
                        )}
                    </div>
                </div>
            )}

            {dialogOpen && preview && (
                <CatdbApprovalDialog
                    batchId={batchId}
                    preview={preview}
                    onClose={() => setDialogOpen(false)}
                    onApproved={handleApproved}
                    onStalePreview={handleStalePreview}
                />
            )}

            <CatdbApprovalHistory batchId={batchId} refreshKey={approvalRefreshKey} onApprovalsLoaded={handleApprovalsLoaded} />
        </div>
    );
}
