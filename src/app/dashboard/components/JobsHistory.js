"use client";

import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Filter, ArrowUpDown, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmtDurationMs } from "@/utils/formatters";

const STATUS_FILTERS = ["all", "queued", "processing", "done", "failed"];

export default function JobsHistory({ jobs, jobError, openJob, deleteJob }) {
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [sortOrder, setSortOrder] = useState("desc");

    const filteredJobs = useMemo(() => {
        const searchLower = search.trim().toLowerCase();
        const toTs = (job) => {
            const candidate = job?.created_at || job?.createdAt || job?.updated_at || job?.started_at || job?.finished_at;
            const ts = Date.parse(String(candidate || ""));
            return Number.isFinite(ts) ? ts : 0;
        };

        const byStatus = (jobs || []).filter((job) => {
            if (statusFilter === "all") return true;
            return String(job?.status || "").toLowerCase() === statusFilter;
        });

        const bySearch = byStatus.filter((job) => {
            if (!searchLower) return true;
            const filename = String(job?.original_filename || "").toLowerCase();
            const id = String(job?.job_id || "").toLowerCase();
            return filename.includes(searchLower) || id.includes(searchLower);
        });

        return [...bySearch].sort((a, b) => {
            const tsDiff = toTs(a) - toTs(b);
            if (tsDiff !== 0) return sortOrder === "asc" ? tsDiff : -tsDiff;

            const idDiff = String(a?.job_id || "").localeCompare(String(b?.job_id || ""));
            return sortOrder === "asc" ? idDiff : -idDiff;
        });
    }, [jobs, search, statusFilter, sortOrder]);

    return (
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-4 sm:p-5 space-y-4 shadow-xl shadow-black/20">
            {jobError && (
                <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
                >
                    {jobError}
                </motion.div>
            )}

            <div className="flex items-center justify-between gap-3">
                <div>
                    <div className="text-[10px] uppercase tracking-[0.22em] font-bold text-white/45">Recent Jobs</div>
                    <div className="text-sm font-semibold text-white/90 mt-1">History and quick access</div>
                </div>
                <div className="text-[11px] text-white/55">{filteredJobs.length} shown</div>
            </div>

            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/35" />
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by filename or job ID"
                        className="h-10 pl-10 text-sm"
                    />
                </div>

                <Button type="button" variant="outline" className="h-10 rounded-xl" onClick={() => setSortOrder((s) => (s === "desc" ? "asc" : "desc"))}>
                    <ArrowUpDown className="h-4 w-4" />
                    {sortOrder === "desc" ? "Newest" : "Oldest"}
                </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold mr-1">
                    <Filter className="h-3.5 w-3.5" />
                    Status
                </div>
                {STATUS_FILTERS.map((status) => {
                    const active = status === statusFilter;
                    return (
                        <button
                            key={status}
                            type="button"
                            onClick={() => setStatusFilter(status)}
                            className={[
                                "px-3 py-1.5 rounded-full text-[10px] uppercase tracking-wider font-bold transition-colors border",
                                active
                                    ? "bg-emerald-500/15 border-emerald-500/35 text-emerald-300"
                                    : "bg-white/5 border-white/10 text-white/55 hover:bg-white/10",
                            ].join(" ")}
                        >
                            {status}
                        </button>
                    );
                })}
            </div>

            <div className="space-y-2 max-h-[430px] overflow-auto pr-1">
                <AnimatePresence initial={false}>
                    {filteredJobs.length ? (
                        filteredJobs.map((job) => (
                            <motion.div
                                key={job.job_id}
                                layout
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                className="rounded-2xl border border-white/10 bg-black/25 hover:bg-black/35 transition-colors"
                            >
                                <button type="button" onClick={() => openJob(job.job_id)} className="w-full text-left px-3 py-3 min-w-0">
                                    <div className="flex items-center justify-between gap-2 min-w-0">
                                        <div className="text-[12px] font-semibold text-white/90 truncate min-w-0">{job.original_filename || `job ${job.job_id}`}</div>
                                        <div
                                            className={[
                                                "text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border",
                                                job.status === "done"
                                                    ? "text-emerald-300 border-emerald-500/30 bg-emerald-500/10"
                                                    : job.status === "failed"
                                                    ? "text-rose-300 border-rose-500/30 bg-rose-500/10"
                                                    : "text-blue-300 border-blue-500/30 bg-blue-500/10",
                                            ].join(" ")}
                                        >
                                            {job.status}
                                        </div>
                                    </div>

                                    <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-white/55">
                                        <div className="truncate">rows: {job.rows ?? 0}{job.columns ? ` • cols: ${job.columns}` : ""}</div>
                                        <div className="tabular-nums">{job.status === "done" || job.status === "failed" ? fmtDurationMs(job.duration_ms) : "…"}</div>
                                    </div>
                                </button>

                                <div className="flex items-center justify-between px-3 pb-3">
                                    <div className="text-[10px] text-white/35 truncate">id: {job.job_id}</div>

                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="h-8 px-3 rounded-xl border-white/15 text-white/80 hover:bg-rose-500/10 hover:border-rose-500/30"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            deleteJob(job.job_id);
                                        }}
                                    >
                                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                                        Delete
                                    </Button>
                                </div>
                            </motion.div>
                        ))
                    ) : (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-white/60 py-8 text-center border border-dashed border-white/10 rounded-2xl">
                            No jobs matching current filters.
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
