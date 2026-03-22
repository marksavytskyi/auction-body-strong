"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Clock3, Loader2, XCircle } from "lucide-react";
import { formatDuration } from "@/utils/formatters";

function getTimerState(jobStatus, isProcessing) {
    if (isProcessing) {
        return {
            label: "Processing now",
            tone: "text-blue-300",
            Icon: Loader2,
            iconClass: "animate-spin",
        };
    }

    if (jobStatus === "done") {
        return {
            label: "Completed in",
            tone: "text-emerald-300",
            Icon: CheckCircle2,
            iconClass: "",
        };
    }

    if (jobStatus === "failed") {
        return {
            label: "Stopped at",
            tone: "text-rose-300",
            Icon: XCircle,
            iconClass: "",
        };
    }

    return {
        label: "Last run",
        tone: "text-white/80",
        Icon: Clock3,
        iconClass: "",
    };
}

export default function NeonJobClock({
    jobStatus,
    isProcessing,
    elapsedSec,
    durationMs,
    processedRows,
    jobRows,
}) {
    const fixedSeconds = useMemo(() => {
        const realtime = Math.max(0, Number(elapsedSec || 0));
        const fromDuration = Math.max(0, Math.floor(Number(durationMs || 0) / 1000));

        if (isProcessing) return realtime;
        return Math.max(realtime, fromDuration);
    }, [durationMs, elapsedSec, isProcessing]);

    const timerState = getTimerState(jobStatus, isProcessing);
    const pretty = formatDuration(fixedSeconds);
    const ringRotation = (fixedSeconds % 60) * 6;

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28 }}
            className="relative mt-4 overflow-hidden rounded-2xl border border-emerald-500/35 bg-[linear-gradient(135deg,rgba(9,26,20,0.96),rgba(7,12,20,0.96))] p-3"
        >
            <div className="pointer-events-none absolute -left-16 top-1/2 h-36 w-36 -translate-y-1/2 rounded-full bg-emerald-500/20 blur-3xl" />
            <div className="pointer-events-none absolute -right-16 top-1/2 h-36 w-36 -translate-y-1/2 rounded-full bg-blue-500/20 blur-3xl" />

            <div className="relative flex items-center gap-3 sm:gap-4">
                <div className="relative h-20 w-20 shrink-0">
                    <motion.div
                        className="absolute inset-0 rounded-full border border-emerald-400/50"
                        animate={isProcessing ? { rotate: 360 } : { rotate: ringRotation }}
                        transition={
                            isProcessing
                                ? { duration: 7, ease: "linear", repeat: Infinity }
                                : { duration: 0.45, ease: "easeOut" }
                        }
                    >
                        <div className="absolute left-1/2 top-1 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-emerald-300 shadow-[0_0_15px_rgba(52,211,153,0.95)]" />
                    </motion.div>

                    <div className="absolute inset-2 rounded-full border border-white/15 bg-black/40" />

                    <div className="absolute inset-0 grid place-items-center">
                        <div className="text-center">
                            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">Clock</div>
                            <div className="mt-0.5 font-mono text-sm font-bold text-emerald-200">
                                {String(Math.floor(fixedSeconds / 60)).padStart(2, "0")}:
                                {String(fixedSeconds % 60).padStart(2, "0")}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="min-w-0 flex-1">
                    <div className={`inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] font-bold ${timerState.tone}`}>
                        <timerState.Icon className={`h-3.5 w-3.5 ${timerState.iconClass}`} />
                        {timerState.label}
                    </div>

                    <div className="mt-1 text-lg sm:text-xl font-black tracking-tight text-emerald-200 drop-shadow-[0_0_12px_rgba(16,185,129,0.45)]">
                        {timerState.label}: {pretty}
                    </div>

                    <div className="mt-1 text-xs text-white/65">
                        Processed: <b className="text-white/90">{processedRows}</b> / <b>{jobRows || "—"}</b>
                    </div>
                </div>
            </div>

            {isProcessing && jobRows > 0 && (
                <div className="relative mt-3 h-1.5 overflow-hidden rounded-full border border-white/10 bg-black/45">
                    <motion.div
                        className="h-full bg-emerald-400 shadow-[0_0_16px_rgba(16,185,129,0.65)]"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, (processedRows / (jobRows || 1)) * 100)}%` }}
                        transition={{ duration: 0.45 }}
                    />
                </div>
            )}
        </motion.div>
    );
}
