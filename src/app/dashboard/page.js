"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useRouter } from "next/navigation";
import axiosInstance from "@/utils/axios";
import { useAuth } from "@/hooks/useAuth";

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

import {
    UploadCloud,
    FileText,
    Loader2,
    RefreshCw,
    LogOut,
    Search,
    Trash2,
    Download,
    ChevronDown,
    ChevronUp,
    Car,
    ExternalLink,
    Settings2,
    CheckSquare,
    Square,
    X,
    LayoutGrid,
    AlertCircle,
    Clock,
    CheckCircle2,
    History,
    ArrowUpDown,
    Eye,
    Zap,
} from "lucide-react";

const MAX_MB = 25;
const MAX_BYTES = MAX_MB * 1024 * 1024;

function formatBytes(bytes) {
    const units = ["B", "KB", "MB", "GB"];
    let i = 0;
    let n = bytes || 0;
    while (n >= 1024 && i < units.length - 1) {
        n /= 1024;
        i++;
    }
    return `${n.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

const fmtDurationMs = (ms) => {
    const n = Number(ms ?? 0)
    if (!Number.isFinite(n) || n <= 0) return "—"
    
    if (n < 1000) return `${n}ms`
    
    const totalSec = Math.floor(n / 1000)
    const hours = Math.floor(totalSec / 3600)
    const minutes = Math.floor((totalSec % 3600) / 60)
    const seconds = totalSec % 60
    
    const parts = []
    if (hours > 0) parts.push(`${hours}h`)
    if (minutes > 0 || hours > 0) parts.push(`${minutes}m`)
    parts.push(`${seconds}s`)
    
    return parts.join(" ")
}
function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}

function formatDuration(totalSec) {
    const s = Math.max(0, Number(totalSec || 0));
    const hours = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    const ss = Math.floor(s % 60);
    
    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (mm > 0 || hours > 0) parts.push(`${mm}m`);
    parts.push(`${ss}s`);
    
    return parts.join(" ");
}

// ---- NEW: safe JSON parse for debug column
function safeJsonParse(v) {
    if (v == null) return null;
    if (typeof v === "object") return v;
    const s = String(v).trim();
    if (!s || s === "-" || s.toLowerCase() === "null") return null;
    try {
        return JSON.parse(s);
    } catch {
        return null;
    }
}

// ---- NEW: DebugTable component to show sub-data info
function DebugTable({ data }) {
    const [visibleKeys, setVisibleKeys] = useState(new Set());
    const [searchKey, setSearchKey] = useState("");

    useEffect(() => {
        if (Array.isArray(data) && data.length > 0) {
            const allKeys = new Set();
            data.forEach(item => {
                if (item && typeof item === "object") {
                    Object.keys(item).forEach(k => allKeys.add(k));
                }
            });
            
            // Если visibleKeys пустой или мы хотим сбросить его при смене данных
            if (visibleKeys.size === 0) {
                setVisibleKeys(allKeys);
            }
        } else if (typeof data === "object" && data !== null && !Array.isArray(data)) {
            // Если это объект, проверим его на наличие спец. полей
            if (data["engine_used_rows"] || data["transmission_used_rows"]) {
                // Это контейнер, не инициализируем ключи здесь
            } else {
                // Обычный объект
                if (visibleKeys.size === 0) {
                    setVisibleKeys(new Set(Object.keys(data)));
                }
            }
        }
    }, [data, visibleKeys.size]);

    if (!data) return null;

    // Рекурсивный вызов для вложенных объектов engine/transmission
    if (typeof data === "object" && !Array.isArray(data) && data !== null) {
        const engineData = data["engine_used_rows"];
        const transmissionData = data["transmission_used_rows"];

        if (engineData || transmissionData) {
            return (
                <div className="flex flex-col gap-6">
                    {engineData && (
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-3 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl w-fit shadow-sm shadow-emerald-900/20">
                                <div className="p-1.5 bg-emerald-500/20 rounded-lg">
                                    <Car className="h-4 w-4 text-emerald-400" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-emerald-400/60 uppercase tracking-[0.2em] leading-none mb-1">Component</span>
                                    <span className="text-xs font-bold text-emerald-50 uppercase tracking-wider">Engine Used Rows</span>
                                </div>
                            </div>
                            <DebugTable data={engineData} />
                        </div>
                    )}
                    
                    {transmissionData && (
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-3 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl w-fit shadow-sm shadow-blue-900/20">
                                <div className="p-1.5 bg-blue-500/20 rounded-lg">
                                    <Settings2 className="h-4 w-4 text-blue-400" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-blue-400/60 uppercase tracking-[0.2em] leading-none mb-1">Component</span>
                                    <span className="text-xs font-bold text-blue-50 uppercase tracking-wider">Transmission Used Rows</span>
                                </div>
                            </div>
                            <DebugTable data={transmissionData} />
                        </div>
                    )}
                </div>
            );
        }
    }

    // Helper to toggle visibility
    const toggleKey = (k) => {
        const next = new Set(visibleKeys);
        if (next.has(k)) next.delete(k);
        else next.add(k);
        setVisibleKeys(next);
    };

    // Helper to render values with link detection and formatting
    const renderVal = (v, key = "") => {
        if (typeof v === "string" && (v.startsWith("http://") || v.startsWith("https://"))) {
            return (
                <a
                    href={v}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2 flex items-center gap-1 transition-colors"
                >
                    Link
                    <ExternalLink className="h-2.5 w-2.5" />
                </a>
            );
        }

        // Format prices/numbers
        if (typeof v === "number" || (typeof v === "string" && !isNaN(v) && v.length > 0 && (key.toLowerCase().includes("price") || key.toLowerCase().includes("cost")))) {
            const num = parseFloat(v);
            if (!isNaN(num)) {
                return (
                    <span className="font-mono text-emerald-400 font-semibold">
                        ${num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </span>
                );
            }
        }
        
        // Format displacement/liters
        if (key.toLowerCase() === "disp" && typeof v === "number") {
            return <span className="text-white/90 font-medium">{v.toFixed(1)} L</span>;
        }

        // Format mileage
        if (key.toLowerCase() === "mileage" && typeof v === "number") {
            return <span className="text-white/90 font-medium">{v.toLocaleString()} km</span>;
        }

        if (typeof v === "object" && v !== null) return JSON.stringify(v);
        return <span className="text-white/80">{String(v ?? "-")}</span>;
    };

    // Helper for pretty labels
    const formatLabel = (s) => {
        const mapping = {
            "vin": "VIN",
            "make": "Make",
            "model": "Model",
            "model_norm": "Model",
            "year": "Year",
            "price": "Price",
            "price_usd": "Price ($)",
            "odometer": "Odometer",
            "mileage": "Mileage",
            "disp": "Engine (L)",
            "engine": "Engine",
            "transmission": "Transmission",
            "color": "Color",
            "location": "Location",
            "lot_url": "Lot URL",
            "auction": "Auction",
            "sold_date": "Sold Date",
            "final_price": "Final Price",
            "avg_price": "Avg Price",
            "distance": "Distance",
            "score": "Match Score",
            "confidence": "Confidence",
            "id": "ID",
            "description": "Description",
        };
        const low = s.toLowerCase();
        if (mapping[low]) return mapping[low];
        
        return s.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
    };

    // Case 1: Array of objects
    if (Array.isArray(data)) {
        if (data.length === 0) return <div className="text-xs text-white/40 italic p-4 bg-white/5 rounded-xl">Empty array</div>;

        const allKeys = data.reduce((acc, item) => {
            if (item && typeof item === "object") {
                Object.keys(item).forEach(k => acc.add(k));
            }
            return acc;
        }, new Set());
        const keys = Array.from(allKeys);

        const sortedKeys = [...keys].sort((a, b) => {
            const priority = { id: 1, model_norm: 2, model: 3, year: 4, disp: 5, mileage: 6, price_usd: 7, price: 8 };
            const pA = priority[a.toLowerCase()] || 99;
            const pB = priority[b.toLowerCase()] || 99;
            return pA - pB;
        });

        const filteredKeysForMenu = sortedKeys.filter(k => k.toLowerCase().includes(searchKey.toLowerCase()));

        return (
            <div className="space-y-4">
                <div className="flex justify-end pr-2">
                    <div className="relative group/menu">
                        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800/50 border border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/10 text-[10px] font-bold text-white/70 uppercase transition-all shadow-lg active:scale-95">
                            <LayoutGrid className="h-3 w-3 text-emerald-400" />
                            Columns ({visibleKeys.size}/{keys.length})
                        </button>
                        
                        {/* Custom Dropdown Content */}
                        <div className="absolute right-0 top-full mt-2 w-56 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl p-3 z-[60] opacity-0 translate-y-2 pointer-events-none group-hover/menu:opacity-100 group-hover/menu:translate-y-0 group-hover/menu:pointer-events-auto transition-all duration-200">
                            <div className="mb-3 space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Visibility</span>
                                    <button 
                                        onClick={() => setVisibleKeys(visibleKeys.size === keys.length ? new Set([sortedKeys[0]]) : new Set(keys))}
                                        className="text-[10px] text-white/40 hover:text-white transition-colors"
                                    >
                                        {visibleKeys.size === keys.length ? "Hide All" : "Show All"}
                                    </button>
                                </div>
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-white/40" />
                                    <input 
                                        type="text" 
                                        placeholder="Search..." 
                                        value={searchKey}
                                        onChange={(e) => setSearchKey(e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500/50 transition-colors"
                                    />
                                </div>
                            </div>
                            <div className="max-h-60 overflow-y-auto pr-1 space-y-0.5 scrollbar-thin scrollbar-thumb-emerald-500/20">
                                {filteredKeysForMenu.map(k => (
                                    <label key={k} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/5 cursor-pointer transition-colors group/item">
                                        <input 
                                            type="checkbox" 
                                            checked={visibleKeys.has(k)}
                                            onChange={() => toggleKey(k)}
                                            className="w-3.5 h-3.5 rounded border-white/20 bg-black/50 text-emerald-500 focus:ring-emerald-500/50 transition-all cursor-pointer"
                                        />
                                        <span className={`text-[11px] truncate ${visibleKeys.has(k) ? 'text-white/90 font-medium' : 'text-white/40 group-hover/item:text-white/60'}`}>
                                            {formatLabel(k)}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/40 overflow-auto scrollbar-thin scrollbar-thumb-white/10">
                    <table className="w-full text-sm">
                        <thead className="bg-white/5 text-white/60">
                            <tr>
                                {sortedKeys.map((k, idx) => {
                                    if (!visibleKeys.has(k)) return null;
                                    return (
                                        <th 
                                            key={idx} 
                                            className="group px-3 py-2 text-left text-xs text-white/70 border-b border-white/10 whitespace-nowrap"
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span>{formatLabel(k)}</span>
                                                <button 
                                                    onClick={() => toggleKey(k)}
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
                            {data.map((item, i) => (
                                <tr key={i} className="odd:bg-white/[0.02] hover:bg-emerald-500/[0.05] transition-colors group border-b border-white/[0.02] last:border-0">
                                    {sortedKeys.map((k, cidx) => {
                                        if (!visibleKeys.has(k)) return null;
                                        return (
                                            <td 
                                                key={cidx} 
                                                className="px-3 py-2 text-white/80 whitespace-nowrap max-w-[200px] truncate"
                                                title={String(item[k] || "")}
                                            >
                                                {renderVal(item[k], k)}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    // Case 2: Single object (key-value)
    if (typeof data === "object") {
        const keys = Object.keys(data);
        if (keys.length === 0) return <div className="text-xs text-white/40 italic">Empty object</div>;

        // Check if there is a main section for "matched cars" or "similar vehicles"
        const pricingKeywords = ["matched_cars", "similar_vehicles", "references", "pricing_data", "similar_cars", "analogs"];
        const pricingKey = keys.find(k => pricingKeywords.includes(k.toLowerCase()));

        return (
            <div className="space-y-4">
                {/* Specific handling for pricing data if found */}
                {pricingKey && (
                    <div className="space-y-2">
                        <div className="text-[10px] font-bold text-emerald-400/80 uppercase tracking-widest flex items-center gap-1.5">
                            <Car className="h-3 w-3" />
                            Vehicles Used for Pricing
                        </div>
                        <DebugTable data={data[pricingKey]} />
                    </div>
                )}

                {/* All other fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {keys.filter(k => k !== pricingKey).map((k) => (
                        <div key={k} className="flex flex-col p-3 rounded-xl bg-white/5 border border-white/10 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all group">
                            <span className="text-[10px] uppercase text-white/40 font-bold mb-1.5 tracking-tight group-hover:text-emerald-400/60 transition-colors" title={k}>
                                {formatLabel(k)}
                            </span>
                            <div className="text-xs text-white/90 break-words font-medium">
                                {typeof data[k] === "object" ? (
                                    <DebugTable data={data[k]} />
                                ) : (
                                    renderVal(data[k], k)
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Case 3: Primitive
    return <div className="text-xs text-white/90">{renderVal(data)}</div>;
}

export default function Page() {
    const router = useRouter();
    const { ready, isLoggedIn } = useAuth();

    // upload / job
    const [file, setFile] = useState(null);
    const [jobId, setJobId] = useState(null);
    const [jobStatus, setJobStatus] = useState(null);
    const [jobError, setJobError] = useState("");
    const [isUploading, setIsUploading] = useState(false);

    // jobs list
    const [jobs, setJobs] = useState([]);

    // server table
    const [headers, setHeaders] = useState([]);
    const [rows, setRows] = useState([]);
    const [totalRows, setTotalRows] = useState(0);

    // UI
    const [query, setQuery] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");
    const [pageSize, setPageSize] = useState(25);
    const [page, setPage] = useState(1);

    const [jobRows, setJobRows] = useState(0);
    const [jobCols, setJobCols] = useState(0);

    // ---- NEW: visible columns state
    const [visibleColumns, setVisibleColumns] = useState(new Set());
    const [showColumnToggle, setShowColumnToggle] = useState(false);
    const [columnSearch, setColumnSearch] = useState("");

    // ---- NEW: Sorting state
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

    // ---- NEW: Sidebar / UI
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [showPreview, setShowPreview] = useState(false);
    const [previewData, setPreviewData] = useState([]);

    // ---- NEW: processed rows counter
    const [processedRows, setProcessedRows] = useState(0);
    const [durationMs, setDurationMs] = useState(0);

    const pollRef = useRef(null);

    // realtime timer
    const [elapsedSec, setElapsedSec] = useState(0);
    const timerRef = useRef(null);
    const startMsRef = useRef(null);

    const isProcessing = jobStatus === "queued" || jobStatus === "processing";

    // ---- NEW: modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalData, setModalData] = useState(null);

    const openModal = useCallback((data) => {
        setModalData(data);
        setIsModalOpen(true);
    }, []);

    const closeModal = useCallback(() => {
        setIsModalOpen(false);
        setModalData(null);
    }, []);

    // guard
    useEffect(() => {
        if (!ready) return;
        if (!isLoggedIn) router.replace("/login");
    }, [ready, isLoggedIn, router]);

    // debounce search
    useEffect(() => {
        const t = setTimeout(() => setDebouncedQuery(query.trim()), 350);
        return () => clearTimeout(t);
    }, [query]);

    const validateFile = useCallback((f) => {
        if (!f) return "No file selected";
        const nameOk = (f.name || "").toLowerCase().endsWith(".csv");
        if (!nameOk) return "Only .csv files are allowed";
        if (f.size === 0) return "File is empty";
        if (f.size > MAX_BYTES) return `File is too large. Max ${MAX_MB}MB`;
        return null;
    }, []);

    const stopTimer = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        startMsRef.current = null;
    }, []);

    const startTimer = useCallback(() => {
        if (timerRef.current) clearInterval(timerRef.current);

        // если уже стартовали — не сбрасываем
        if (!startMsRef.current) startMsRef.current = Date.now();

        timerRef.current = setInterval(() => {
            if (!startMsRef.current) return;
            setElapsedSec(Math.floor((Date.now() - startMsRef.current) / 1000));
        }, 1000);
    }, []);

    // IMPORTANT: timer follows jobStatus
    useEffect(() => {
        if (isProcessing) {
            startTimer();
        } else {
            stopTimer();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isProcessing]);

    const resetAll = useCallback(() => {
        setFile(null);
        setJobId(null);
        setJobStatus(null);
        setJobError("");
        setIsUploading(false);

        setHeaders([]);
        setRows([]);
        setTotalRows(0);

        setQuery("");
        setDebouncedQuery("");
        setPage(1);
        setPageSize(25);

        setJobRows(0);
        setJobCols(0);
        setProcessedRows(0);
        setDurationMs(0);

        setVisibleColumns(new Set());
        setShowColumnToggle(false);

        // ---- NEW: reset modal
        setIsModalOpen(false);
        setModalData(null);

        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }

        stopTimer();
        setElapsedSec(0);
    }, [stopTimer]);

    // Dropzone
    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedRows = useMemo(() => {
        if (!sortConfig.key) return rows;
        return [...rows].sort((a, b) => {
            const aVal = a[sortConfig.key];
            const bVal = b[sortConfig.key];
            
            // Handle numeric values
            const aNum = parseFloat(String(aVal).replace(/[^0-9.-]+/g, ""));
            const bNum = parseFloat(String(bVal).replace(/[^0-9.-]+/g, ""));
            
            if (!isNaN(aNum) && !isNaN(bNum)) {
                return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum;
            }
            
            // String comparison
            const aStr = String(aVal || "").toLowerCase();
            const bStr = String(bVal || "").toLowerCase();
            if (aStr < bStr) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aStr > bStr) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [rows, sortConfig]);

    const onDrop = useCallback(
        (acceptedFiles, rejections) => {
            setJobError("");
            if (rejections?.length) {
                const msg = rejections[0]?.errors?.[0]?.message || "File rejected";
                setJobError(msg);
                toast.error(msg);
                return;
            }
            const f = acceptedFiles?.[0];
            const err = validateFile(f);
            if (err) {
                setJobError(err);
                toast.error(err);
                return;
            }
            setFile(f);
            
            // CSV Preview logic
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target.result;
                const lines = text.split("\n").filter(l => l.trim()).slice(0, 6);
                const data = lines.map(line => line.split(",").map(c => c.trim().replace(/^"|"$/g, "")));
                setPreviewData(data);
                setShowPreview(true);
                toast.success("File ready for preview");
            };
            reader.readAsText(f.slice(0, 10000));
        },
        [validateFile]
    );

    const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
        onDrop,
        accept: { "text/csv": [".csv"] },
        maxFiles: 1,
        multiple: false,
        noClick: true,
        noKeyboard: true,
    });

    const toggleColumn = (col) => {
        setVisibleColumns(prev => {
            const next = new Set(prev);
            if (next.has(col)) {
                if (next.size > 1) next.delete(col); // Don't allow hiding all columns
            } else {
                next.add(col);
            }
            return next;
        });
    };

    const toggleAllColumns = () => {
        setVisibleColumns(prev => {
            if (prev.size === headers.length) {
                // If all selected, keep only the first one to avoid empty table
                return new Set([headers[0]]);
            }
            return new Set(headers);
        });
    };

    const isAllSelected = visibleColumns.size === headers.length;

    const filteredHeaders = useMemo(() => {
        if (!columnSearch) return headers;
        const s = columnSearch.toLowerCase();
        return headers.filter(h => String(h || "").toLowerCase().includes(s));
    }, [headers, columnSearch]);

    // API: list jobs
    const loadJobs = useCallback(async () => {
        try {
            const res = await axiosInstance.get("/csv-vehicle/jobs");
            setJobs(Array.isArray(res.data) ? res.data : []);
        } catch {
            // ignore
        }
    }, []);

    useEffect(() => {
        if (!ready || !isLoggedIn) return;
        loadJobs();
    }, [ready, isLoggedIn, loadJobs]);

    // API: meta
    const fetchJobMeta = useCallback(async (id) => {
        const res = await axiosInstance.get(`/csv-vehicle/jobs/${id}`);
        const data = res.data || {};
        setJobId(data.job_id);
        setJobStatus(data.status); // IMPORTANT: always set current status
        setJobError(data.error || "");
        setJobRows(data.rows || 0);
        setJobCols(data.columns || 0);
        setProcessedRows(data.processed_rows || 0);
        setDurationMs(data.duration_ms || 0);
        return data;
    }, []);

    // API: preview page
    const fetchPreviewPage = useCallback(async (id, p, ps, q) => {
        const res = await axiosInstance.get(`/csv-vehicle/jobs/${id}/preview`, {
            params: { page: p, page_size: ps, query: q || "" },
        });
        const data = res.data || {};
        const newHeaders = Array.isArray(data.headers) ? data.headers : [];
        setHeaders(newHeaders);
        setRows(Array.isArray(data.rows) ? data.rows : []);
        setTotalRows(Number(data.total_rows || 0));

        // Initialize visible columns if not set
        setVisibleColumns(prev => {
            if (prev.size > 0) return prev;
            return new Set(newHeaders);
        });

        return data;
    }, []);

    // polling meta until done/failed
    const startPolling = useCallback(
        (id) => {
            if (pollRef.current) clearInterval(pollRef.current);

            pollRef.current = setInterval(async () => {
                try {
                    const meta = await fetchJobMeta(id); // updates jobStatus
                    const st = meta.status;

                    if (st === "done" || st === "failed") {
                        clearInterval(pollRef.current);
                        pollRef.current = null;

                        await loadJobs();

                        if (st === "done") {
                            setPage(1);
                            setQuery("");
                            // ---- NEW: reset modal on done
                            setIsModalOpen(false);
                            setModalData(null);
                            await fetchPreviewPage(id, 1, pageSize, "");
                        }
                    }
                } catch {
                    // ignore
                }
            }, 1200);
        },
        [fetchJobMeta, loadJobs, fetchPreviewPage, pageSize]
    );

    // Download result CSV
    const downloadResult = useCallback(async () => {
        if (!jobId) return;
        try {
            const res = await axiosInstance.get(`/csv-vehicle/jobs/${jobId}/download`, {
                responseType: "blob",
            });

            const blob = new Blob([res.data], { type: "text/csv;charset=utf-8" });
            const url = window.URL.createObjectURL(blob);

            const a = document.createElement("a");
            a.href = url;
            a.download = `enriched_${jobId}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();

            window.URL.revokeObjectURL(url);
            toast.success("CSV Downloaded successfully");
        } catch (e) {
            toast.error(e?.response?.data?.detail || "Download failed");
        }
    }, [jobId]);

    // Upload
    const upload = useCallback(async () => {
        setJobError("");
        const err = validateFile(file);
        if (err) {
            setJobError(err);
            toast.error(err);
            return;
        }

        setIsUploading(true);
        const uploadToast = toast.loading("Uploading and starting processing...");

        // reset view
        setHeaders([]);
        setRows([]);
        setTotalRows(0);
        setJobRows(0);
        setJobCols(0);
        setShowPreview(false);

        // ---- NEW: modal reset on new upload
        setIsModalOpen(false);
        setModalData(null);

        // start immediately showing timer + spinner
        setJobStatus("processing");
        setElapsedSec(0);
        startMsRef.current = Date.now();

        try {
            const form = new FormData();
            form.append("file", file);

            const res = await axiosInstance.post("/csv-vehicle/process-csv", form, {
                headers: { "Content-Type": "multipart/form-data" },
            });

            const id = res?.data?.job_id;
            if (!id) throw new Error("No job_id returned from server");

            setJobId(id);
            setJobStatus(res?.data?.status || "processing");
            setPage(1);
            setQuery("");

            await loadJobs();
            await fetchJobMeta(id);

            // show immediate preview (source.csv) even while processing
            await fetchPreviewPage(id, 1, pageSize, "");

            // start polling until done/failed
            startPolling(id);
            toast.success("Upload successful! Processing...", { id: uploadToast });
        } catch (e) {
            const msg = e?.response?.data?.detail || e?.message || "Upload failed";
            setJobError(String(msg));
            setJobStatus("failed");
            toast.error(String(msg), { id: uploadToast });
        } finally {
            setIsUploading(false);
        }
    }, [file, validateFile, loadJobs, fetchJobMeta, fetchPreviewPage, pageSize, startPolling]);

    // Open job
    const openJob = useCallback(
        async (id) => {
            resetAll();
            const openToast = toast.loading("Opening job...");
            try {
                const meta = await fetchJobMeta(id);
                setJobId(id);
                setPage(1);
                setQuery("");
                // ---- NEW: modal reset on open
                setIsModalOpen(false);
                setModalData(null);
                await fetchPreviewPage(id, 1, 25, "");

                // if not finished — keep polling and show realtime timer
                if (meta.status === "processing" || meta.status === "queued") {
                    setElapsedSec(0);
                    startMsRef.current = Date.now();
                    startPolling(id);
                }
                toast.success(`Job #${id} opened`, { id: openToast });
            } catch {
                setJobError("Job not found or you have no access.");
                toast.error("Failed to open job", { id: openToast });
            }
        },
        [fetchJobMeta, fetchPreviewPage, resetAll, startPolling]
    );

    // Delete job
    const deleteJob = useCallback(
        async (id) => {
            if (!confirm("Delete this job?")) return;
            const delToast = toast.loading("Deleting job...");
            try {
                await axiosInstance.delete(`/csv-vehicle/jobs/${id}`);
                if (jobId === id) resetAll();
                await loadJobs();
                toast.success("Job deleted", { id: delToast });
            } catch (e) {
                toast.error(e?.response?.data?.detail || "Failed to delete job", { id: delToast });
            }
        },
        [jobId, resetAll, loadJobs]
    );

    // When page/pageSize/query changes -> load server page
    useEffect(() => {
        if (!jobId) return;
        if (jobStatus !== "done") return;
        fetchPreviewPage(jobId, page, pageSize, debouncedQuery);
    }, [jobId, jobStatus, page, pageSize, debouncedQuery, fetchPreviewPage]);

    const totalPages = useMemo(() => Math.max(1, Math.ceil(totalRows / pageSize)), [totalRows, pageSize]);
    const safePage = useMemo(() => clamp(page, 1, totalPages), [page, totalPages]);

    useEffect(() => {
        setPage(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedQuery, pageSize]);

    const statusBadge = useMemo(() => {
        const s = jobStatus;
        if (!s) return null;
        const base = "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border backdrop-blur-md";
        if (s === "done") return <span className={`${base} border-emerald-500/30 bg-emerald-500/10 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]`}>done</span>;
        if (s === "failed") return <span className={`${base} border-rose-500/30 bg-rose-500/10 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.1)]`}>failed</span>;
        if (s === "processing") return <span className={`${base} border-blue-500/30 bg-blue-500/10 text-blue-400 animate-pulse`}>processing</span>;
        return <span className={`${base} border-white/20 bg-white/5 text-white/60`}>{s}</span>;
    }, [jobStatus]);

    // ---- NEW: find debug column index (optional)
    const debugColIdx = useMemo(() => {
        if (!headers?.length) return -1;
        const candidates = ["pricing_debug_json", "pricing_debug", "debug_json", "debug"];
        const lower = headers.map((h) => String(h || "").toLowerCase());
        for (const c of candidates) {
            const idx = lower.indexOf(c);
            if (idx >= 0) return idx;
        }
        return -1;
    }, [headers]);

    if (!ready) {
        return (
            <div className="min-h-screen w-full flex items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black">
                <div className="text-slate-200">Loading…</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen w-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-700 via-indigo-900 to-slate-950">
            <div className="mx-auto max-w-6xl px-4 py-10">
                {/* Top bar */}
                <div className="mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-white/90">
                        <UploadCloud className="h-6 w-6" />
                        <div className="text-lg font-semibold">CSV Processor</div>
                    </div>

                    <Button variant="secondary" className="rounded-full" onClick={() => router.push("/logout")}>
                        <LogOut className="mr-2 h-4 w-4" />
                        Logout
                    </Button>
                </div>

                <div className="flex flex-col gap-6">
                    {/* Upload + jobs */}
                    <CardContent className="grid gap-6 md:grid-cols-[420px_1fr]">
                        {/* Upload zone */}
                        <div
                            {...getRootProps()}
                            className={[
                                "rounded-2xl border border-dashed p-4 transition-all",
                                "bg-gradient-to-b from-white/5 to-white/0 cursor-pointer",
                                isDragActive ? "border-white/60" : "border-white/20",
                            ].join(" ")}
                        >
                            <input {...getInputProps()} />

                            {/* Header */}
                            <div className="flex items-start justify-between gap-3 min-w-0">
                                <div className="min-w-0">
                                    <div className="text-sm font-medium text-white/90 truncate">
                                        {isDragActive ? "Drop it here" : "Drag & drop CSV here"}
                                    </div>
                                    <div className="text-xs text-white/60 truncate">
                                        Max size: {MAX_MB}MB
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    {statusBadge}
                                    {isProcessing && <Loader2 className="h-4 w-4 animate-spin text-white/80" />}
                                </div>
                            </div>

                            {/* Buttons */}
                            <div className="mt-3 grid grid-cols-2 gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="h-9 rounded-full justify-center"
                                    onClick={open}
                                >
                                    <FileText className="h-4 w-4 mr-1" />
                                    Browse
                                </Button>

                                <Button
                                    type="button"
                                    className="h-9 rounded-full justify-center"
                                    onClick={upload}
                                    disabled={!file || isUploading}
                                >
                                    {isUploading ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                            Uploading…
                                        </>
                                    ) : (
                                        <>
                                            <UploadCloud className="h-4 w-4 mr-1" />
                                            Upload
                                        </>
                                    )}
                                </Button>

                                <Button
                                    type="button"
                                    variant="secondary"
                                    className="h-9 rounded-full justify-center"
                                    onClick={resetAll}
                                >
                                    <RefreshCw className="h-4 w-4 mr-1" />
                                    Reset
                                </Button>

                                <Button
                                    type="button"
                                    variant="secondary"
                                    className="h-9 rounded-full justify-center"
                                    onClick={downloadResult}
                                    disabled={!jobId || jobStatus !== "done"}
                                >
                                    <Download className="h-4 w-4 mr-1" />
                                    Download
                                </Button>
                            </div>

                            {/* File info */}
                            <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 min-w-0">
                                <div className="text-sm font-medium truncate">
                                    {file ? file.name : "No file selected"}
                                </div>
                                <div className="text-xs text-white/60 truncate">
                                    {file ? `${formatBytes(file.size)} • ${file.type || "csv"}` : "Choose a file"}
                                </div>
                            </div>

                            {/* Job info */}
                            {(jobId || jobStatus) && (
                                <div className="mt-2 text-xs text-white/70 truncate">
                                    Job: <b className="text-white/90">{jobId ?? "—"}</b>
                                </div>
                            )}

                            {isProcessing && (
                                <div className="mt-2 space-y-1">
                                    <div className="text-xs text-white/60">
                                        Processing time: <b>{formatDuration(elapsedSec)}</b>
                                    </div>
                                    <div className="text-xs text-white/60">
                                        Processed: <b className="text-white/90">{processedRows}</b> / <b>{jobRows || "—"}</b>
                                    </div>
                                    {/* Optional: simple progress bar */}
                                    {jobRows > 0 && (
                                        <div className="w-full bg-white/10 rounded-full h-1 mt-1 overflow-hidden">
                                            <div
                                                className="bg-accent h-full transition-all duration-500"
                                                style={{ width: `${Math.min(100, (processedRows / (jobRows || 1)) * 100)}%` }}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            {jobStatus === "done" && (
                                <div className="mt-2 space-y-1">
                                    <div className="text-xs text-emerald-400">
                                        Completed in: <b>{fmtDurationMs(durationMs)}</b>
                                    </div>
                                    <div className="text-xs text-emerald-400">
                                        Total cars processed: <b>{jobRows}</b>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Right column */}
                        <div className="space-y-3">
                            {jobError && (
                                <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-50">
                                    {jobError}
                                </div>
                            )}

                            <div>
                                <div className="mb-2 flex items-center justify-between">
                                    <div className="text-sm font-semibold text-white/90">Recent jobs</div>
                                    <div className="text-[11px] text-white/50 truncate">
                                        showing {jobs?.length || 0}
                                    </div>
                                </div>

                                <div className="space-y-2 max-h-[340px] overflow-auto pr-1">
                                    {jobs?.length ? (
                                        jobs.map((j) => (
                                            <div
                                                key={j.job_id}
                                                className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition"
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => openJob(j.job_id)}
                                                    className="w-full text-left px-3 py-2 min-w-0"
                                                >
                                                    {/* Row 1: name + status */}
                                                    <div className="flex items-center justify-between gap-2 min-w-0">
                                                        <div className="text-[12px] text-white/90 truncate min-w-0">
                                                            {j.original_filename || `job ${j.job_id}`}
                                                        </div>

                                                        <div className="shrink-0 flex items-center gap-2">
                                                            <div className="text-[11px] text-white/55">{j.status}</div>
                                                        </div>
                                                    </div>

                                                    {/* Row 2: meta line (compact) */}
                                                    <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-white/55 min-w-0">
                                                        <div className="truncate min-w-0">
                                                            rows: {j.rows || 0} • cols: {j.columns || 0}
                                                        </div>

                                                        {/* Fixed duration */}
                                                        <div className="shrink-0 tabular-nums">
                                                            {j.status === "done" || j.status === "failed" ? (
                                                                <span>
                    {fmtDurationMs(j.duration_ms)}
                  </span>
                                                            ) : (
                                                                <span>…</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </button>

                                                {/* Compact actions */}
                                                <div className="flex items-center justify-between px-3 pb-2">
                                                    <div className="text-[10px] text-white/40 truncate min-w-0">
                                                        id: {j.job_id}
                                                    </div>

                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        className="h-7 px-3 rounded-full border-white/15 text-white/80 hover:bg-white/10"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            deleteJob(j.job_id)
                                                        }}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                                                        Delete
                                                    </Button>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-xs text-white/60">No jobs yet.</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                    {/* Results */}
                    <Card className="pt-12 border-white/10 bg-white/5 text-white shadow-2xl backdrop-blur-xl overflow-hidden">
                        <CardHeader>
                            <CardTitle>Results</CardTitle>
                            <CardDescription className="text-white/70">
                                {jobStatus === "done" ? `Rows: ${jobRows} • Columns: ${jobCols}` : "Upload a CSV to see results."}
                            </CardDescription>
                        </CardHeader>

                        <CardContent className="p-4">
                            {/* Controls */}
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div className="relative w-full md:max-w-sm">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60" />
                                    <Input
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        placeholder="Search in table…"
                                        className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/40"
                                        disabled={!jobId || jobStatus !== "done"}
                                    />
                                </div>

                                <div className="flex flex-wrap items-center gap-3">
                                    <div className="relative">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="rounded-full border-white/10 bg-white/5 text-white"
                                            onClick={() => setShowColumnToggle(!showColumnToggle)}
                                            disabled={!jobId || jobStatus !== "done" || headers.length === 0}
                                        >
                                            <Settings2 className="mr-2 h-4 w-4" />
                                            Columns ({visibleColumns.size}/{headers.length})
                                        </Button>

                                        {showColumnToggle && (
                                            <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-white/10 bg-slate-900 p-2 shadow-2xl backdrop-blur-xl">
                                                <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-2 px-2">
                                                    <span className="text-xs font-bold text-white/60 uppercase tracking-wider">Visible Columns</span>
                                                    <button 
                                                        onClick={toggleAllColumns}
                                                        className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold uppercase"
                                                    >
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

                                                <div className="max-h-60 overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-white/10">
                                                    {filteredHeaders.map((h, i) => (
                                                        <button
                                                            key={i}
                                                            onClick={() => toggleColumn(h)}
                                                            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-white/80 hover:bg-white/5 transition-colors"
                                                        >
                                                            {visibleColumns.has(h) ? (
                                                                <CheckSquare className="h-4 w-4 text-emerald-500" />
                                                            ) : (
                                                                <Square className="h-4 w-4 text-white/20" />
                                                            )}
                                                            <span className="truncate">{h || `Col ${i+1}`}</span>
                                                        </button>
                                                    ))}
                                                    {filteredHeaders.length === 0 && (
                                                        <div className="px-2 py-4 text-center text-[10px] text-white/40 italic">
                                                            No columns found
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <Button
                                        type="button"
                                        className="rounded-full"
                                        onClick={downloadResult}
                                        disabled={!jobId || jobStatus !== "done"}
                                    >
                                        <Download className="mr-2 h-4 w-4" />
                                        Download CSV
                                    </Button>

                                    <div className="flex items-center gap-2">
                                        <div className="text-xs text-white/70 whitespace-nowrap">Page size</div>
                                        <select
                                            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
                                            value={pageSize}
                                            onChange={(e) => setPageSize(Number(e.target.value))}
                                            disabled={!jobId || jobStatus !== "done"}
                                        >
                                            {[10, 25, 50, 100, 200].map((n) => (
                                                <option key={n} value={n}>
                                                    {n}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Table */}
                            <div className="mt-4">
                                {isProcessing ? (
                                    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 flex items-center gap-3">
                                        <Loader2 className="h-5 w-5 animate-spin text-white/80" />
                                        <div className="text-sm text-white/80">
                                            Processing… <span className="text-white/60">({formatDuration(elapsedSec)})</span>
                                        </div>
                                    </div>
                                ) : null}

                                {jobStatus === "done" && jobId ? (
                                    <>
                                        <div className="rounded-2xl border border-white/10 bg-black/20 overflow-auto max-h-[70vh] scrollbar-thin scrollbar-thumb-white/10">
                                            <table className="w-full text-sm">
                                                <thead className="sticky top-0 bg-black/60 backdrop-blur z-10">
                                                <tr>
                                                    <th className="px-3 py-2 text-left text-xs text-white/70 border-b border-white/10 whitespace-nowrap bg-black/60">
                                                        #
                                                    </th>

                                                    {headers.map((h, idx) => {
                                                        if (!visibleColumns.has(h)) return null;
                                                        return (
                                                            <th
                                                                key={idx}
                                                                className="group px-3 py-2 text-left text-xs text-white/70 border-b border-white/10 whitespace-nowrap bg-black/60"
                                                            >
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <span>{h || `Column ${idx + 1}`}</span>
                                                                    <button
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
                                                {rows.map((r, ridx) => {
                                                    const globalIndex = (safePage - 1) * pageSize + ridx + 1;

                                                    // NEW: use stable key from Lot URL if possible
                                                    const lotUrlIdx = headers.findIndex((h) => String(h || "").toLowerCase() === "lot url");
                                                    const lotUrlKey = lotUrlIdx >= 0 ? headers[lotUrlIdx] : null;
                                                    const rowKey = (lotUrlKey ? r?.[lotUrlKey] : null) || `row_${globalIndex}`;

                                                    // NEW: parse debug details if present
                                                    const debugKey = debugColIdx >= 0 ? headers[debugColIdx] : null;
                                                    const rawDebug = debugKey ? r?.[debugKey] : null;
                                                    const debugObj = safeJsonParse(rawDebug);

                                                    const canOpen = Boolean(debugObj);

                                                    return (
                                                        <React.Fragment key={rowKey}>
                                                            <tr className="odd:bg-white/[0.03] hover:bg-white/[0.05] transition-colors">
                                                                <td className="px-3 py-2 text-xs text-white/60 border-b border-white/5 whitespace-nowrap">
                                                                    {globalIndex}
                                                                </td>

                                                                {headers.map((h, cidx) => {
                                                                    if (!visibleColumns.has(h)) return null;
                                                                    
                                                                    // Check if this is the debug column
                                                                    const isDebug = String(h || "").toLowerCase().includes("debug_json");

                                                                    return (
                                                                        <td
                                                                            key={cidx}
                                                                            className="px-3 py-2 border-b border-white/5 text-white/80 whitespace-nowrap max-w-[250px] truncate"
                                                                            title={!isDebug ? String((r && r[h]) ?? "") : ""}
                                                                        >
                                                                            {isDebug && canOpen ? (
                                                                                <button
                                                                                    onClick={() => openModal(debugObj)}
                                                                                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-colors text-[10px] font-bold uppercase tracking-wider"
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
                                                        </React.Fragment>
                                                    );
                                                })}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Pagination */}
                                        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="text-xs text-white/60 text-center sm:text-left">
                                                Showing{" "}
                                                <b className="text-white/80">{totalRows === 0 ? 0 : (safePage - 1) * pageSize + 1}</b> –{" "}
                                                <b className="text-white/80">{Math.min(safePage * pageSize, totalRows)}</b> of{" "}
                                                <b className="text-white/80">{totalRows}</b> rows
                                            </div>

                                            <div className="flex flex-wrap items-center justify-center gap-2">
                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-8 rounded-lg border-white/20 text-white hover:bg-white/10 px-2 sm:px-3"
                                                        onClick={() => setPage(1)}
                                                        disabled={safePage === 1}
                                                    >
                                                        First
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-8 rounded-lg border-white/20 text-white hover:bg-white/10 px-2 sm:px-3"
                                                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                                                        disabled={safePage === 1}
                                                    >
                                                        Prev
                                                    </Button>
                                                </div>

                                                <div className="text-[11px] sm:text-xs text-white/70 px-1 font-medium min-w-[80px] text-center">
                                                    Page <b className="text-white/90">{safePage}</b> /{" "}
                                                    <b className="text-white/90">{totalPages}</b>
                                                </div>

                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-8 rounded-lg border-white/20 text-white hover:bg-white/10 px-2 sm:px-3"
                                                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                                        disabled={safePage === totalPages}
                                                    >
                                                        Next
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-8 rounded-lg border-white/20 text-white hover:bg-white/10 px-2 sm:px-3"
                                                        onClick={() => setPage(totalPages)}
                                                        disabled={safePage === totalPages}
                                                    >
                                                        Last
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
                                        No active job. Upload a CSV to see results here.
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Modal for Details */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div 
                        className="relative w-full max-w-6xl max-h-[90vh] overflow-hidden bg-zinc-900 rounded-3xl border border-white/10 shadow-2xl flex flex-col animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="p-4 sm:p-6 border-b border-white/5 bg-white/5">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-emerald-500/10 rounded-xl shrink-0">
                                        <LayoutGrid className="h-5 w-5 text-emerald-400" />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <h3 className="text-base sm:text-lg font-bold text-white uppercase tracking-tight truncate">Pricing & Match Evidence</h3>
                                        <p className="text-[10px] sm:text-xs text-white/40 font-medium truncate">Detailed component intelligence and matching analytics</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={closeModal}
                                    className="absolute top-4 right-4 sm:relative sm:top-auto sm:right-auto p-2 rounded-xl hover:bg-white/10 text-white/40 hover:text-white transition-all active:scale-95"
                                >
                                    <X className="h-6 w-6" />
                                </button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-white/10">
                            {modalData ? (
                                <DebugTable data={modalData} />
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12 gap-3 text-white/20">
                                    <AlertCircle className="h-12 w-12" />
                                    <p className="text-sm font-medium">No detailed information available.</p>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-white/5 bg-black/20 flex justify-end">
                            <Button 
                                variant="outline" 
                                onClick={closeModal}
                                className="rounded-xl border-white/10 hover:bg-white/5 text-white font-bold px-6"
                            >
                                Close
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}