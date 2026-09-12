"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ArrowLeft, Loader2, CheckCircle2, Ban, ScrollText, Layers, Camera } from "lucide-react";

import { getCaptureDetail, approveCapture, rejectCapture, getReviewLog } from "@/lib/catalytic/moderation";
import { CatalyticApiError } from "@/lib/catalytic/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import CaptureStatusBadge from "@/components/catalytic/CaptureStatusBadge";

function fmtDate(s) {
    if (!s) return "—";
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? s : d.toLocaleString();
}

// The backend normalizes position_code (e.g. "front left" -> "front_left")
// — verified live. Show it the way the worker typed it.
function humanizePosition(code) {
    return String(code || "").replace(/_/g, " ");
}

function CatalystReviewRow({ catalyst, suggestions, override, onOverrideChange }) {
    return (
        <div className="rounded-xl border border-white/10 bg-black/25 p-3 space-y-2">
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                    <div className="text-[10px] uppercase tracking-wider text-white/40 font-bold">Worker Entered</div>
                    <div className="font-bold text-sm text-white/90 capitalize">{humanizePosition(catalyst.position_code)}</div>
                    <div className="text-xs text-white/60 font-mono">
                        {catalyst.code_unreadable ? <span className="italic text-white/35">code unreadable</span> : catalyst.physical_code_raw || "—"}
                    </div>
                    {catalyst.notes && <div className="text-[11px] text-white/35 italic mt-1">{catalyst.notes}</div>}
                </div>
                {catalyst.photos?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 max-w-[220px]">
                        {catalyst.photos.map((p) =>
                            p.view_url ? (
                                <a key={p.id} href={p.view_url} target="_blank" rel="noreferrer" className="relative w-12 h-12 rounded-lg overflow-hidden border border-white/10 bg-black/40 shrink-0">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={p.view_url} alt={p.original_filename} className="w-full h-full object-cover" />
                                </a>
                            ) : (
                                <span key={p.id} className="inline-flex items-center gap-1 text-[10px] text-white/40">
                                    <Camera className="h-3 w-3" /> {p.original_filename}
                                </span>
                            )
                        )}
                    </div>
                )}
            </div>

            {suggestions?.suggestions?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    <span className="text-[10px] text-white/35 self-center mr-1">Suggestions (non-binding):</span>
                    {suggestions.suggestions.slice(0, 6).map((s, idx) => (
                        <button
                            key={idx}
                            type="button"
                            onClick={() => onOverrideChange({ ...override, physical_code_raw: s.code })}
                            className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border border-white/10 bg-white/5 text-white/60 hover:border-sky-500/40 hover:text-sky-300 transition-colors"
                            title={`${Math.round((s.probability || 0) * 100)}% · ${s.source} · ${s.observed_count} observed`}
                        >
                            {s.code}
                        </button>
                    ))}
                </div>
            )}

            <div className="grid gap-2 sm:grid-cols-2 pt-1 border-t border-white/5">
                <div className="space-y-1">
                    <Label className="text-white/40 text-[10px] uppercase tracking-wider">Approve As — Position</Label>
                    <Input
                        value={override.position_code ?? ""}
                        onChange={(e) => onOverrideChange({ ...override, position_code: e.target.value })}
                        placeholder={catalyst.position_code}
                        className="h-8 rounded-lg bg-white/5 border-white/10 text-xs"
                    />
                </div>
                <div className="space-y-1">
                    <Label className="text-white/40 text-[10px] uppercase tracking-wider">Approve As — Code</Label>
                    <Input
                        value={override.physical_code_raw ?? ""}
                        onChange={(e) => onOverrideChange({ ...override, physical_code_raw: e.target.value })}
                        placeholder={catalyst.physical_code_raw || "—"}
                        className="h-8 rounded-lg bg-white/5 border-white/10 text-xs font-mono uppercase"
                    />
                </div>
                {(override.position_code || override.physical_code_raw) && (
                    <div className="sm:col-span-2 text-[10px] text-amber-300/80">
                        Leaving these blank approves exactly what the worker entered above.
                    </div>
                )}
            </div>
        </div>
    );
}

export default function ModerationDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params?.id;

    const [detail, setDetail] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");
    const [overrides, setOverrides] = useState({});
    const [moderatorNotes, setModeratorNotes] = useState("");
    const [rejectReason, setRejectReason] = useState("");
    const [showReject, setShowReject] = useState(false);
    const [isApproving, setIsApproving] = useState(false);
    const [isRejecting, setIsRejecting] = useState(false);
    const [reviewLog, setReviewLog] = useState(null);

    const load = useCallback(async () => {
        if (!id) return;
        setIsLoading(true);
        setError("");
        try {
            const data = await getCaptureDetail(id);
            setDetail(data);
        } catch (e) {
            setError(e instanceof CatalyticApiError ? e.message : "Failed to load capture");
        } finally {
            setIsLoading(false);
        }
    }, [id]);

    useEffect(() => {
        load();
    }, [load]);

    const suggestionsByCatalyst = useMemo(() => {
        const map = {};
        (detail?.suggestions || []).forEach((s) => {
            map[s.catalyst_capture_id] = s;
        });
        return map;
    }, [detail]);

    const handleApprove = async () => {
        setIsApproving(true);
        try {
            const catalyst_overrides = Object.entries(overrides)
                .filter(([, v]) => v.position_code || v.physical_code_raw)
                .map(([catalystId, v]) => ({
                    catalyst_capture_id: Number(catalystId),
                    position_code: v.position_code || null,
                    physical_code_raw: v.physical_code_raw || null,
                }));

            await approveCapture(id, { moderator_notes: moderatorNotes.trim(), catalyst_overrides });
            toast.success("Capture approved");
            router.push("/cats/moderation");
        } catch (e) {
            toast.error(e instanceof CatalyticApiError ? e.message : "Failed to approve");
        } finally {
            setIsApproving(false);
        }
    };

    const handleReject = async () => {
        if (!rejectReason.trim()) return;
        setIsRejecting(true);
        try {
            await rejectCapture(id, rejectReason.trim(), moderatorNotes.trim());
            toast.success("Capture rejected");
            router.push("/cats/moderation");
        } catch (e) {
            toast.error(e instanceof CatalyticApiError ? e.message : "Failed to reject");
        } finally {
            setIsRejecting(false);
        }
    };

    const loadReviewLog = async () => {
        try {
            const data = await getReviewLog(id);
            setReviewLog(Array.isArray(data) ? data : []);
        } catch (e) {
            toast.error(e instanceof CatalyticApiError ? e.message : "Failed to load review log");
        }
    };

    if (isLoading) {
        return <div className="flex items-center gap-2 text-white/50 text-sm py-12 justify-center"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
    }

    if (error || !detail) {
        return (
            <div className="space-y-4">
                <Button variant="outline" size="sm" className="rounded-xl border-white/15" onClick={() => router.push("/cats/moderation")}>
                    <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to queue
                </Button>
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium">{error || "Not found"}</div>
            </div>
        );
    }

    const isPending = detail.status === "PENDING_REVIEW";

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <Button variant="outline" size="sm" className="rounded-xl border-white/15" onClick={() => router.push("/cats/moderation")}>
                    <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to queue
                </Button>
                <CaptureStatusBadge status={detail.status} />
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5 sm:p-6">
                <div className="font-bold text-lg text-white/90">
                    {[detail.year, detail.make, detail.model].filter(Boolean).join(" ") || "Vehicle not identified"}
                </div>
                <div className="text-xs text-white/45 mt-1 flex items-center gap-3 flex-wrap">
                    {detail.engine && <span>{detail.engine}</span>}
                    {detail.vin && <span className="font-mono">{detail.vin}</span>}
                    <span>submitted {fmtDate(detail.submitted_at)} by user #{detail.submitted_by_user_id}</span>
                </div>
                {detail.notes && <p className="text-xs text-white/35 italic mt-2">{detail.notes}</p>}
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5 sm:p-6 space-y-3">
                <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-white/40 font-bold">
                    <Layers className="h-3.5 w-3.5 text-emerald-400" />
                    Catalysts ({detail.catalysts?.length || 0})
                </div>
                {detail.catalysts?.length ? (
                    detail.catalysts.map((cat) => (
                        <CatalystReviewRow
                            key={cat.id}
                            catalyst={cat}
                            suggestions={suggestionsByCatalyst[cat.id]}
                            override={overrides[cat.id] || {}}
                            onOverrideChange={(next) => setOverrides((o) => ({ ...o, [cat.id]: next }))}
                        />
                    ))
                ) : (
                    <div className="text-xs text-white/35 italic">No catalysts on this capture.</div>
                )}
            </div>

            {isPending && (
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5 sm:p-6 space-y-3">
                    <Label className="text-white/60 text-xs uppercase tracking-wider">Moderator notes (optional)</Label>
                    <textarea
                        value={moderatorNotes}
                        onChange={(e) => setModeratorNotes(e.target.value)}
                        rows={2}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/50 resize-none"
                    />

                    {showReject ? (
                        <div className="space-y-2">
                            <Label className="text-rose-300 text-xs uppercase tracking-wider">Rejection reason (required)</Label>
                            <Input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="h-10 rounded-xl bg-white/5 border-white/10" />
                            <div className="flex gap-2">
                                <Button variant="destructive" className="rounded-xl" isLoading={isRejecting} disabled={!rejectReason.trim()} onClick={handleReject}>
                                    <Ban className="h-4 w-4 mr-1.5" /> Confirm Reject
                                </Button>
                                <Button variant="outline" className="rounded-xl border-white/15" onClick={() => setShowReject(false)}>Cancel</Button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            <Button className="rounded-2xl h-12 px-6" isLoading={isApproving} onClick={handleApprove}>
                                <CheckCircle2 className="h-4 w-4 mr-1.5" /> Approve
                            </Button>
                            <Button variant="destructive" className="rounded-2xl h-12 px-6" onClick={() => setShowReject(true)}>
                                <Ban className="h-4 w-4 mr-1.5" /> Reject
                            </Button>
                        </div>
                    )}
                </div>
            )}

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <button type="button" onClick={loadReviewLog} className="inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white/80 font-bold uppercase tracking-wider">
                    <ScrollText className="h-3.5 w-3.5" /> {reviewLog ? "Refresh review log" : "Load review log"}
                </button>
                {reviewLog && (
                    <div className="mt-3 space-y-1.5">
                        {reviewLog.length === 0 ? (
                            <p className="text-xs text-white/35 italic">No review actions logged yet.</p>
                        ) : (
                            reviewLog.map((r) => (
                                <div key={r.id} className="text-xs text-white/60 flex items-center justify-between">
                                    <span>{r.action} by user #{r.actor_user_id}{r.reason ? ` — ${r.reason}` : ""}</span>
                                    <span className="text-white/35">{fmtDate(r.created_at)}</span>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
