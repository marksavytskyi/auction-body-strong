"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { UploadCloud, Loader2, FileText, RefreshCw, Download, Eye, Maximize2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatBytes } from "@/utils/formatters";
import NeonJobClock from "./NeonJobClock";
import TableFullscreenModal from "@/components/dashboard/TableFullscreenModal";

const MAX_MB = 25;

export default function UploadCard({
    getRootProps,
    getInputProps,
    isDragActive,
    statusBadge,
    isProcessing,
    open,
    upload,
    file,
    isUploading,
    resetAll,
    downloadResult,
    jobId,
    jobStatus,
    elapsedSec,
    processedRows,
    jobRows,
    durationMs,
    csvPreviewRows,
    isInitialLoading,
}) {
    const [isPreviewFullscreen, setIsPreviewFullscreen] = useState(false);
    const [fullPreviewRows, setFullPreviewRows] = useState([]);
    const [isFullPreviewLoading, setIsFullPreviewLoading] = useState(false);
    const [fullPreviewError, setFullPreviewError] = useState("");
    const [fullscreenQuery, setFullscreenQuery] = useState("");
    const [fullscreenPage, setFullscreenPage] = useState(1);
    const [fullscreenPageSize, setFullscreenPageSize] = useState(50);

    const hasPreview = Array.isArray(csvPreviewRows) && csvPreviewRows.length > 0;

    const hasFullPreview = Array.isArray(fullPreviewRows) && fullPreviewRows.length > 0;
    const fullscreenRows = hasFullPreview ? fullPreviewRows : csvPreviewRows;
    const fullscreenHeaderRow = fullscreenRows[0] || [];
    const fullscreenAllBodyRows = fullscreenRows.slice(1);
    const inlineHeaderRow = csvPreviewRows[0] || [];
    const inlineBodyRows = csvPreviewRows.slice(1);

    const normalizedFullscreenQuery = fullscreenQuery.trim().toLowerCase();

    const fullscreenFilteredRows = useMemo(() => {
        if (!normalizedFullscreenQuery) return fullscreenAllBodyRows;

        return fullscreenAllBodyRows.filter((line) =>
            line.some((cell) => String(cell ?? "").toLowerCase().includes(normalizedFullscreenQuery))
        );
    }, [fullscreenAllBodyRows, normalizedFullscreenQuery]);

    const fullscreenTotalRows = fullscreenFilteredRows.length;
    const fullscreenTotalPages = Math.max(1, Math.ceil(fullscreenTotalRows / fullscreenPageSize));
    const fullscreenSafePage = Math.min(Math.max(fullscreenPage, 1), fullscreenTotalPages);

    const fullscreenPagedRows = useMemo(() => {
        const start = (fullscreenSafePage - 1) * fullscreenPageSize;
        return fullscreenFilteredRows.slice(start, start + fullscreenPageSize);
    }, [fullscreenFilteredRows, fullscreenSafePage, fullscreenPageSize]);

    const parseCsvText = useCallback((text) => {
        const input = String(text || "");
        const rows = [];

        let row = [];
        let cell = "";
        let inQuotes = false;

        const pushCell = () => {
            row.push(cell.trim().replace(/^\uFEFF/, ""));
            cell = "";
        };

        const pushRow = () => {
            if (!row.length) return;
            const hasValues = row.some((value) => String(value || "").trim() !== "");
            if (hasValues) rows.push(row);
            row = [];
        };

        for (let i = 0; i < input.length; i += 1) {
            const ch = input[i];

            if (ch === "\"") {
                const isEscapedQuote = inQuotes && input[i + 1] === "\"";
                if (isEscapedQuote) {
                    cell += "\"";
                    i += 1;
                    continue;
                }

                inQuotes = !inQuotes;
                continue;
            }

            if (!inQuotes && ch === ",") {
                pushCell();
                continue;
            }

            if (!inQuotes && (ch === "\n" || ch === "\r")) {
                pushCell();
                pushRow();
                if (ch === "\r" && input[i + 1] === "\n") i += 1;
                continue;
            }

            cell += ch;
        }

        pushCell();
        pushRow();

        return rows;
    }, []);

    const loadFullPreview = useCallback(async () => {
        if (!file) return;
        if (fullPreviewRows.length > 0 || isFullPreviewLoading) return;

        setIsFullPreviewLoading(true);
        setFullPreviewError("");

        try {
            const parsed = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (event) => resolve(parseCsvText(event?.target?.result || ""));
                reader.onerror = () => reject(new Error("Failed to read file"));
                reader.readAsText(file);
            });

            setFullPreviewRows(Array.isArray(parsed) ? parsed : []);
        } catch {
            setFullPreviewError("Failed to load full preview");
        } finally {
            setIsFullPreviewLoading(false);
        }
    }, [file, isFullPreviewLoading, parseCsvText]);

    useEffect(() => {
        setFullPreviewRows([]);
        setIsFullPreviewLoading(false);
        setFullPreviewError("");
        setFullscreenQuery("");
        setFullscreenPage(1);
    }, [file]);

    useEffect(() => {
        if (!file) return;
        loadFullPreview();
    }, [file, loadFullPreview]);

    useEffect(() => {
        if (!isPreviewFullscreen) return;
        loadFullPreview();
    }, [isPreviewFullscreen, loadFullPreview]);

    useEffect(() => {
        setFullscreenPage(1);
    }, [fullscreenQuery, fullscreenPageSize]);

    const renderPreviewTable = ({ headerRow, bodyRows, maxHeightClass = "max-h-44", showLoader = false, errorText = "" }) => (
        <div className={`${maxHeightClass} overflow-auto`}>
            {showLoader ? (
                <div className="px-3 py-8 text-xs text-emerald-300 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading full file preview...
                </div>
            ) : null}

            {errorText ? <div className="px-3 py-3 text-xs text-rose-300">{errorText}</div> : null}

            <table className="w-full text-[11px]">
                <thead className="bg-black/30 sticky top-0">
                    <tr>
                        {headerRow.map((headerCell, idx) => (
                            <th key={`preview_head_${idx}`} className="px-2 py-1.5 text-left text-white/70 border-b border-white/5 font-semibold whitespace-nowrap">
                                {headerCell || `Column ${idx + 1}`}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {bodyRows.map((line, ridx) => (
                        <tr key={`preview_row_${ridx}`} className="odd:bg-white/[0.02]">
                            {line.map((cell, cidx) => (
                                <td key={`preview_cell_${ridx}_${cidx}`} className="px-2 py-1.5 text-white/70 border-b border-white/[0.04] whitespace-nowrap max-w-[180px] truncate" title={cell}>
                                    {cell}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    return (
        <motion.div
            {...getRootProps()}
            whileHover={{ y: -2 }}
            className={[
                "rounded-3xl border border-dashed p-5 transition-all duration-300 cursor-pointer",
                "glass-card shadow-xl shadow-black/20",
                isDragActive ? "border-emerald-400/70 bg-emerald-500/[0.08]" : "border-white/15",
            ].join(" ")}
        >
            <input {...getInputProps()} />

            <div className="flex items-start justify-between gap-3 min-w-0">
                <div className="min-w-0">
                    <div className="text-sm font-bold text-white/90 uppercase tracking-wider truncate">
                        {isDragActive ? "Drop CSV here" : "Upload Source File"}
                    </div>
                    <div className="text-[11px] text-white/45 uppercase tracking-[0.2em] truncate mt-1">Max size: {MAX_MB}MB</div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {statusBadge}
                    {isProcessing && <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />}
                </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" className="h-10 rounded-2xl justify-center" onClick={(e) => { e.stopPropagation(); open(); }}>
                    <FileText className="h-4 w-4 mr-1.5" />
                    Browse
                </Button>

                <Button type="button" className="h-10 rounded-2xl justify-center" onClick={(e) => { e.stopPropagation(); upload(); }} disabled={!file || isUploading}>
                    {isUploading ? (
                        <>
                            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                            Uploading
                        </>
                    ) : (
                        <>
                            <UploadCloud className="h-4 w-4 mr-1.5" />
                            Process
                        </>
                    )}
                </Button>

                <Button type="button" variant="secondary" className="h-10 rounded-2xl justify-center" onClick={(e) => { e.stopPropagation(); resetAll(); }}>
                    <RefreshCw className="h-4 w-4 mr-1.5" />
                    Reset
                </Button>

                <Button
                    type="button"
                    variant="secondary"
                    className="h-10 rounded-2xl justify-center"
                    onClick={(e) => { e.stopPropagation(); downloadResult(); }}
                    disabled={!jobId || jobStatus !== "done"}
                >
                    <Download className="h-4 w-4 mr-1.5" />
                    Download
                </Button>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 px-3 py-3 min-w-0">
                <div className="text-sm font-semibold text-white truncate">{file ? file.name : "No file selected"}</div>
                <div className="text-xs text-white/50 truncate mt-1">{file ? `${formatBytes(file.size)} • ${file.type || "csv"}` : "Choose a CSV and preview it"}</div>
            </div>

            {(jobId || jobStatus) && (
                <div className="mt-3 text-[11px] text-white/55 uppercase tracking-[0.18em] truncate">
                    Active Job: <b className="text-white/85 normal-case tracking-normal">{jobId ?? "—"}</b>
                </div>
            )}

            {jobStatus || isInitialLoading ? (
                <NeonJobClock
                    jobStatus={jobStatus}
                    isProcessing={isProcessing}
                    elapsedSec={elapsedSec}
                    durationMs={durationMs}
                    processedRows={processedRows}
                    jobRows={jobRows}
                    isInitialLoading={isInitialLoading}
                />
            ) : null}

            {hasPreview && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className="mt-4 rounded-2xl border border-emerald-500/20 bg-black/35 overflow-hidden"
                >
                    <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-white/10 bg-emerald-500/10">
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">
                            <Eye className="h-3.5 w-3.5" />
                            CSV Preview
                        </div>
                        <button
                            type="button"
                            onClick={(event) => {
                                event.stopPropagation();
                                loadFullPreview();
                                setIsPreviewFullscreen(true);
                            }}
                            className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-black/35 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-200 hover:bg-emerald-500/15 transition-colors"
                            title="Open preview table in fullscreen"
                        >
                            <Maximize2 className="h-3 w-3" />
                            Fullscreen
                        </button>
                    </div>

                    {renderPreviewTable({
                        headerRow: inlineHeaderRow,
                        bodyRows: inlineBodyRows,
                        maxHeightClass: "max-h-44",
                    })}
                </motion.div>
            )}

            <TableFullscreenModal
                isOpen={isPreviewFullscreen}
                onClose={() => setIsPreviewFullscreen(false)}
                title={file ? `CSV Preview: ${file.name} (${Math.max(0, fullscreenTotalRows)} rows)` : "CSV Preview"}
            >
                <div className="h-full flex flex-col">
                    <div className="shrink-0 px-4 py-3 border-b border-white/10 bg-[#090b10]/95 backdrop-blur">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="relative w-full md:max-w-sm">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
                                <Input
                                    value={fullscreenQuery}
                                    onChange={(event) => setFullscreenQuery(event.target.value)}
                                    placeholder="Search in preview..."
                                    className="pl-9 h-10"
                                    disabled={isFullPreviewLoading || fullscreenHeaderRow.length === 0}
                                />
                            </div>

                            <div className="flex flex-wrap items-center gap-2.5">
                                <div className="text-[11px] text-white/70 whitespace-nowrap rounded-xl border border-white/10 bg-white/[0.04] px-3 h-10 flex items-center">
                                    Matches: <b className="ml-1 text-white/90">{fullscreenTotalRows}</b>
                                </div>

                                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 h-10">
                                    <div className="text-[11px] text-white/70 whitespace-nowrap">Page size</div>
                                    <select
                                        className="bg-transparent text-sm text-white outline-none"
                                        value={fullscreenPageSize}
                                        onChange={(event) => setFullscreenPageSize(Number(event.target.value))}
                                        disabled={isFullPreviewLoading || fullscreenHeaderRow.length === 0}
                                    >
                                        {[25, 50, 100, 200, 500].map((size) => (
                                            <option key={size} value={size} className="bg-[#090b10]">
                                                {size}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 min-h-0">
                        {renderPreviewTable({
                            headerRow: fullscreenHeaderRow,
                            bodyRows: fullscreenPagedRows,
                            maxHeightClass: "h-full",
                            showLoader: isFullPreviewLoading,
                            errorText: fullPreviewError,
                        })}
                    </div>

                    <div className="shrink-0 px-4 py-3 border-t border-white/10 bg-[#090b10]/95 backdrop-blur flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-xs text-white/60 text-center sm:text-left">
                            Showing <b className="text-white/80">{fullscreenTotalRows === 0 ? 0 : (fullscreenSafePage - 1) * fullscreenPageSize + 1}</b> -{" "}
                            <b className="text-white/80">{Math.min(fullscreenSafePage * fullscreenPageSize, fullscreenTotalRows)}</b> of{" "}
                            <b className="text-white/80">{fullscreenTotalRows}</b> rows
                        </div>

                        <div className="flex flex-wrap items-center justify-center gap-2">
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 rounded-lg border-white/20 px-2 sm:px-3"
                                    onClick={() => setFullscreenPage(1)}
                                    disabled={fullscreenSafePage === 1 || isFullPreviewLoading}
                                >
                                    First
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 rounded-lg border-white/20 px-2 sm:px-3"
                                    onClick={() => setFullscreenPage((prev) => Math.max(1, prev - 1))}
                                    disabled={fullscreenSafePage === 1 || isFullPreviewLoading}
                                >
                                    Prev
                                </Button>
                            </div>

                            <div className="text-[11px] sm:text-xs text-white/70 px-1 font-medium min-w-[80px] text-center">
                                Page <b className="text-white/90">{fullscreenSafePage}</b> / <b className="text-white/90">{fullscreenTotalPages}</b>
                            </div>

                            <div className="flex items-center gap-1">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 rounded-lg border-white/20 px-2 sm:px-3"
                                    onClick={() => setFullscreenPage((prev) => Math.min(fullscreenTotalPages, prev + 1))}
                                    disabled={fullscreenSafePage === fullscreenTotalPages || isFullPreviewLoading}
                                >
                                    Next
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 rounded-lg border-white/20 px-2 sm:px-3"
                                    onClick={() => setFullscreenPage(fullscreenTotalPages)}
                                    disabled={fullscreenSafePage === fullscreenTotalPages || isFullPreviewLoading}
                                >
                                    Last
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </TableFullscreenModal>
        </motion.div>
    );
}
