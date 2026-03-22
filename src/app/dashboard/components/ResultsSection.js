"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
    Search,
    Settings2,
    CheckSquare,
    Square,
    X,
    Download,
    Loader2,
    LayoutGrid,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    Maximize2,
    Minimize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clamp, formatDuration, safeJsonParse } from "@/utils/formatters";
import TableFullscreenModal from "@/components/dashboard/TableFullscreenModal";

const VISIBLE_COLUMNS_STORAGE_KEY = "dashboard:visible-columns";

function sortRows(rows, sortConfig) {
    if (!sortConfig?.key) return rows;

    const directionMult = sortConfig.direction === "asc" ? 1 : -1;

    return [...rows].sort((a, b) => {
        const aVal = a?.[sortConfig.key];
        const bVal = b?.[sortConfig.key];

        const aNum = Number(String(aVal ?? "").replace(/[^\d.-]/g, ""));
        const bNum = Number(String(bVal ?? "").replace(/[^\d.-]/g, ""));

        if (Number.isFinite(aNum) && Number.isFinite(bNum) && String(aVal ?? "").trim() !== "" && String(bVal ?? "").trim() !== "") {
            return (aNum - bNum) * directionMult;
        }

        const aStr = String(aVal ?? "").toLowerCase();
        const bStr = String(bVal ?? "").toLowerCase();

        if (aStr < bStr) return -1 * directionMult;
        if (aStr > bStr) return 1 * directionMult;
        return 0;
    });
}

export default function ResultsSection({
    jobId,
    jobStatus,
    jobRows,
    jobCols,
    headers,
    rows,
    totalRows,
    query,
    setQuery,
    page,
    setPage,
    pageSize,
    setPageSize,
    isProcessing,
    elapsedSec,
    downloadResult,
    openModal,
}) {
    const [visibleColumns, setVisibleColumns] = useState(new Set());
    const [showColumnToggle, setShowColumnToggle] = useState(false);
    const [columnSearch, setColumnSearch] = useState("");
    const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
    const [isTableFullscreen, setIsTableFullscreen] = useState(false);

    const inlineColumnMenuRef = useRef(null);
    const fullscreenColumnMenuRef = useRef(null);

    useEffect(() => {
        if (!headers.length) {
            setVisibleColumns(new Set());
            return;
        }

        if (typeof window === "undefined") {
            setVisibleColumns((prev) => (prev.size ? prev : new Set(headers)));
            return;
        }

        const savedRaw = window.localStorage.getItem(VISIBLE_COLUMNS_STORAGE_KEY);
        if (!savedRaw) {
            setVisibleColumns((prev) => {
                if (!prev.size) return new Set(headers);

                const intersected = headers.filter((header) => prev.has(header));
                return intersected.length ? new Set(intersected) : new Set(headers);
            });
            return;
        }

        try {
            const saved = JSON.parse(savedRaw);
            const savedSet = new Set(Array.isArray(saved) ? saved : []);
            const intersected = headers.filter((header) => savedSet.has(header));
            setVisibleColumns(intersected.length ? new Set(intersected) : new Set(headers));
        } catch {
            setVisibleColumns(new Set(headers));
        }
    }, [headers]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        if (!visibleColumns.size) return;
        window.localStorage.setItem(VISIBLE_COLUMNS_STORAGE_KEY, JSON.stringify(Array.from(visibleColumns)));
    }, [visibleColumns]);

    useEffect(() => {
        if (!showColumnToggle) return;

        const onOutsideClick = (event) => {
            const insideInline = inlineColumnMenuRef.current?.contains(event.target);
            const insideFullscreen = fullscreenColumnMenuRef.current?.contains(event.target);

            if (!insideInline && !insideFullscreen) {
                setShowColumnToggle(false);
            }
        };

        const onEscape = (event) => {
            if (event.key === "Escape") setShowColumnToggle(false);
        };

        document.addEventListener("mousedown", onOutsideClick);
        document.addEventListener("keydown", onEscape);

        return () => {
            document.removeEventListener("mousedown", onOutsideClick);
            document.removeEventListener("keydown", onEscape);
        };
    }, [showColumnToggle]);

    const handleSort = (column) => {
        setSortConfig((prev) => {
            if (prev.key === column) {
                return { key: column, direction: prev.direction === "asc" ? "desc" : "asc" };
            }
            return { key: column, direction: "asc" };
        });
    };

    const sortedRows = useMemo(() => sortRows(rows, sortConfig), [rows, sortConfig]);

    const toggleColumn = (column) => {
        setVisibleColumns((prev) => {
            const next = new Set(prev);
            if (next.has(column)) {
                if (next.size > 1) next.delete(column);
            } else {
                next.add(column);
            }
            return next;
        });
    };

    const toggleAllColumns = () => {
        setVisibleColumns((prev) => {
            if (!headers.length) return prev;
            if (prev.size === headers.length) return new Set([headers[0]]);
            return new Set(headers);
        });
    };

    const filteredHeaders = useMemo(() => {
        if (!columnSearch) return headers;
        const search = columnSearch.toLowerCase();
        return headers.filter((h) => String(h || "").toLowerCase().includes(search));
    }, [columnSearch, headers]);

    const debugColIdx = useMemo(() => {
        if (!headers.length) return -1;
        const candidates = ["pricing_debug_json", "pricing_debug", "debug_json", "debug"];
        const lower = headers.map((h) => String(h || "").toLowerCase());

        for (const candidate of candidates) {
            const idx = lower.indexOf(candidate);
            if (idx >= 0) return idx;
        }

        return -1;
    }, [headers]);

    const totalPages = useMemo(() => Math.max(1, Math.ceil(totalRows / pageSize)), [totalRows, pageSize]);
    const safePage = useMemo(() => clamp(page, 1, totalPages), [page, totalPages]);
    const isAllSelected = visibleColumns.size === headers.length;
    const normalizedStatus = String(jobStatus || "").toLowerCase();
    const canReadPreview = Boolean(jobId) && ["queued", "processing", "done"].includes(normalizedStatus);
    const hasTableData = headers.length > 0;

    const sortedByLabel = sortConfig.key ? `${sortConfig.key} (${sortConfig.direction})` : "no sorting";

    const renderResultsTable = (heightClass = "max-h-[70vh]", fullscreen = false) => (
        <div
            className={[
                fullscreen
                    ? "h-full max-h-none overflow-auto bg-black/40"
                    : "rounded-2xl border border-white/10 bg-black/30 overflow-auto",
                heightClass,
            ].join(" ")}
        >
            <table className="w-full text-sm">
                <thead className="sticky top-0 bg-black/75 backdrop-blur z-10">
                    <tr>
                        <th className="px-3 py-2 text-left text-xs text-white/70 border-b border-white/10 whitespace-nowrap">#</th>

                        {headers.map((h, idx) => {
                            if (!visibleColumns.has(h)) return null;

                            const isSorted = sortConfig.key === h;
                            const SortIcon = isSorted ? (sortConfig.direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;

                            return (
                                <th key={`${String(h)}_${idx}`} className="group px-3 py-2 text-left text-xs text-white/70 border-b border-white/10 whitespace-nowrap">
                                    <div className="flex items-center justify-between gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleSort(h)}
                                            className="inline-flex items-center gap-1.5 hover:text-white transition-colors"
                                            title="Sort by column"
                                        >
                                            <span>{h || `Column ${idx + 1}`}</span>
                                            <SortIcon className={`h-3.5 w-3.5 ${isSorted ? "text-emerald-400" : "text-white/35"}`} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => toggleColumn(h)}
                                            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/10 text-white/40 hover:text-red-400 transition-all"
                                            title="Hide column"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </div>
                                </th>
                            );
                        })}
                    </tr>
                </thead>

                <tbody>
                    {sortedRows.map((r, ridx) => {
                        const globalIndex = (safePage - 1) * pageSize + ridx + 1;
                        const lotUrlIdx = headers.findIndex((h) => String(h || "").toLowerCase() === "lot url");
                        const lotUrlKey = lotUrlIdx >= 0 ? headers[lotUrlIdx] : null;
                        const rowKey = `${(lotUrlKey ? r?.[lotUrlKey] : null) || "row"}_${globalIndex}_${ridx}`;

                        const debugKey = debugColIdx >= 0 ? headers[debugColIdx] : null;
                        const rawDebug = debugKey ? r?.[debugKey] : null;
                        const debugObj = safeJsonParse(rawDebug);
                        const canOpen = Boolean(debugObj);

                        return (
                            <tr key={rowKey} className="odd:bg-white/[0.03] hover:bg-emerald-500/[0.08] transition-colors">
                                <td className="px-3 py-2 text-xs text-white/60 border-b border-white/5 whitespace-nowrap">{globalIndex}</td>

                                {headers.map((h, cidx) => {
                                    if (!visibleColumns.has(h)) return null;

                                    const isDebug = String(h || "").toLowerCase().includes("debug_json");

                                    return (
                                        <td
                                            key={`${String(h)}_${cidx}`}
                                            className="px-3 py-2 border-b border-white/5 text-white/80 whitespace-nowrap max-w-[250px] truncate"
                                            title={!isDebug ? String((r && r[h]) ?? "") : ""}
                                        >
                                            {isDebug && canOpen ? (
                                                <button
                                                    onClick={() => openModal(debugObj)}
                                                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/20 transition-colors text-[10px] font-bold uppercase tracking-wider"
                                                >
                                                    <LayoutGrid className="h-3 w-3" />
                                                    View Details
                                                </button>
                                            ) : (
                                                String((r && r[h]) ?? "")
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );

    const renderTableControls = ({ fullscreen = false, menuRef }) => (
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
                <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search in table..."
                    className="pl-9 h-10"
                    disabled={!canReadPreview}
                />
            </div>

            <div className="flex flex-wrap items-center gap-2.5" ref={menuRef}>
                <div className="relative">
                    <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl border-white/15 bg-white/[0.04]"
                        onClick={() => setShowColumnToggle((s) => !s)}
                        disabled={!canReadPreview || headers.length === 0}
                    >
                        <Settings2 className="mr-1.5 h-4 w-4" />
                        Columns ({visibleColumns.size}/{headers.length})
                    </Button>

                    {showColumnToggle && (
                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-white/10 bg-[#0c0e13] p-2 shadow-2xl"
                        >
                            <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-2 px-2">
                                <span className="text-xs font-bold text-white/60 uppercase tracking-wider">Visible Columns</span>
                                <button onClick={toggleAllColumns} className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold uppercase">
                                    {isAllSelected ? "Deselect All" : "Select All"}
                                </button>
                            </div>

                            <div className="px-2 mb-2">
                                <div className="relative">
                                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-white/40" />
                                    <input
                                        type="text"
                                        placeholder="Search column..."
                                        className="w-full rounded-lg border border-white/10 bg-white/5 py-1 pl-7 pr-2 text-[10px] text-white outline-none focus:border-emerald-500/50 transition-colors"
                                        value={columnSearch}
                                        onChange={(e) => setColumnSearch(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div className="max-h-60 overflow-y-auto space-y-1">
                                {filteredHeaders.map((h, i) => (
                                    <button
                                        key={`${String(h)}_${i}`}
                                        onClick={() => toggleColumn(h)}
                                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-white/80 hover:bg-white/5 transition-colors"
                                    >
                                        {visibleColumns.has(h) ? <CheckSquare className="h-4 w-4 text-emerald-500" /> : <Square className="h-4 w-4 text-white/20" />}
                                        <span className="truncate">{h || `Col ${i + 1}`}</span>
                                    </button>
                                ))}
                                {filteredHeaders.length === 0 && <div className="px-2 py-4 text-center text-[10px] text-white/40 italic">No columns found</div>}
                            </div>
                        </motion.div>
                    )}
                </div>

                <Button type="button" className="rounded-xl" onClick={downloadResult} disabled={!jobId || jobStatus !== "done"}>
                    <Download className="mr-1.5 h-4 w-4" />
                    Download CSV
                </Button>

                <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl border-white/15 bg-white/[0.04]"
                    onClick={() => setIsTableFullscreen((s) => !s)}
                    disabled={!canReadPreview || !hasTableData}
                >
                    {fullscreen ? <Minimize2 className="mr-1.5 h-4 w-4" /> : <Maximize2 className="mr-1.5 h-4 w-4" />}
                    {fullscreen ? "Exit Fullscreen" : "Fullscreen"}
                </Button>

                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 h-10">
                    <div className="text-[11px] text-white/70 whitespace-nowrap">Page size</div>
                    <select
                        className="bg-transparent text-sm text-white outline-none"
                        value={pageSize}
                        onChange={(e) => setPageSize(Number(e.target.value))}
                        disabled={!canReadPreview}
                    >
                        {[10, 25, 50, 100, 200].map((n) => (
                            <option key={n} value={n} className="bg-[#090b10]">
                                {n}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
        </div>
    );

    const renderPagination = ({ fullscreen = false } = {}) => (
        <div className={`${fullscreen ? "px-4 py-3 border-t border-white/10 bg-[#090b10]/95 backdrop-blur" : "mt-4"} flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between`}>
            <div className="text-xs text-white/60 text-center sm:text-left">
                Showing <b className="text-white/80">{totalRows === 0 ? 0 : (safePage - 1) * pageSize + 1}</b> - <b className="text-white/80">{Math.min(safePage * pageSize, totalRows)}</b> of{" "}
                <b className="text-white/80">{totalRows}</b> rows
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
                <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" className="h-8 rounded-lg border-white/20 px-2 sm:px-3" onClick={() => setPage(1)} disabled={safePage === 1}>
                        First
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 rounded-lg border-white/20 px-2 sm:px-3" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}>
                        Prev
                    </Button>
                </div>

                <div className="text-[11px] sm:text-xs text-white/70 px-1 font-medium min-w-[80px] text-center">
                    Page <b className="text-white/90">{safePage}</b> / <b className="text-white/90">{totalPages}</b>
                </div>

                <div className="flex items-center gap-1">
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-lg border-white/20 px-2 sm:px-3"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={safePage === totalPages}
                    >
                        Next
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 rounded-lg border-white/20 px-2 sm:px-3" onClick={() => setPage(totalPages)} disabled={safePage === totalPages}>
                        Last
                    </Button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl overflow-hidden shadow-xl shadow-black/20">
            <div className="px-5 py-5 sm:px-6 sm:py-6 border-b border-white/[0.06]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h2 className="text-xl sm:text-2xl font-black tracking-tight uppercase italic text-gradient">
                            Results <span className="emerald-gradient">Table</span>
                        </h2>
                        <p className="text-sm text-white/55 mt-1">
                            {canReadPreview ? `Rows: ${jobRows} • Columns: ${jobCols} • Status: ${normalizedStatus || "unknown"}` : "Upload a CSV to see results."}
                        </p>
                    </div>
                    <div className="text-[10px] uppercase tracking-[0.22em] text-white/40 font-bold mt-1">Sorted: {sortedByLabel}</div>
                </div>
            </div>

            <div className="p-4 sm:p-5">
                {renderTableControls({ fullscreen: false, menuRef: inlineColumnMenuRef })}

                <div className="mt-4">
                    {isProcessing ? (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl border border-white/10 bg-white/5 p-6 flex items-center gap-3">
                            <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
                    <div className="text-sm text-white/80">
                        Processing... <span className="text-white/60">({formatDuration(elapsedSec)})</span>
                    </div>
                </motion.div>
                    ) : null}

                    {canReadPreview ? (
                        <>
                            {hasTableData ? (
                                <>
                                    {renderResultsTable("max-h-[70vh]")}
                                    {renderPagination()}
                                </>
                            ) : (
                                <div className="rounded-2xl border border-white/10 bg-black/30 p-8 text-sm text-white/65 text-center">
                                    Waiting for preview data from backend...
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="rounded-2xl border border-white/10 bg-black/30 p-8 text-sm text-white/65 text-center">
                            No active job. Upload a CSV to see results here.
                        </div>
                    )}
                </div>
            </div>

            <TableFullscreenModal
                isOpen={isTableFullscreen}
                onClose={() => setIsTableFullscreen(false)}
                title="Results Table"
            >
                <div className="h-full flex flex-col">
                    <div className="shrink-0 px-4 py-3 border-b border-white/10 bg-[#090b10]/95 backdrop-blur">
                        {renderTableControls({ fullscreen: true, menuRef: fullscreenColumnMenuRef })}
                    </div>
                    <div className="flex-1 min-h-0">{renderResultsTable("h-full", true)}</div>
                    <div className="shrink-0">{renderPagination({ fullscreen: true })}</div>
                </div>
            </TableFullscreenModal>
        </div>
    );
}
