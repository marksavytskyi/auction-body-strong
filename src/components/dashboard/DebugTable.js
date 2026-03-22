"use client";

import React, { useState, useEffect } from "react";
import { 
    Car, 
    Settings2, 
    ExternalLink, 
    LayoutGrid, 
    Search, 
    X,
    Maximize2,
} from "lucide-react";
import TableFullscreenModal from "@/components/dashboard/TableFullscreenModal";

/**
 * DebugTable component to show sub-data info
 */
export function DebugTable({ data }) {
    const [visibleKeys, setVisibleKeys] = useState(new Set());
    const [searchKey, setSearchKey] = useState("");
    const [isTableFullscreen, setIsTableFullscreen] = useState(false);

    useEffect(() => {
        if (Array.isArray(data) && data.length > 0) {
            const allKeys = new Set();
            data.forEach(item => {
                if (item && typeof item === "object") {
                    Object.keys(item).forEach(k => allKeys.add(k));
                }
            });
            
            if (visibleKeys.size === 0) {
                setVisibleKeys(allKeys);
            }
        } else if (typeof data === "object" && data !== null && !Array.isArray(data)) {
            if (!(data["engine_used_rows"] || data["transmission_used_rows"])) {
                if (visibleKeys.size === 0) {
                    setVisibleKeys(new Set(Object.keys(data)));
                }
            }
        }
    }, [data, visibleKeys.size]);

    if (!data) return null;

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

    const toggleKey = (k) => {
        const next = new Set(visibleKeys);
        if (next.has(k)) next.delete(k);
        else next.add(k);
        setVisibleKeys(next);
    };

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
        
        if (key.toLowerCase() === "disp" && typeof v === "number") {
            return <span className="text-white/90 font-medium">{v.toFixed(1)} L</span>;
        }

        if (key.toLowerCase() === "mileage" && typeof v === "number") {
            return <span className="text-white/90 font-medium">{v.toLocaleString()} km</span>;
        }

        if (typeof v === "object" && v !== null) return JSON.stringify(v);
        return <span className="text-white/80">{String(v ?? "-")}</span>;
    };

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

        const renderArrayTable = (maxHeightClass = "", fullscreen = false) => (
            <div
                className={[
                    fullscreen
                        ? "h-full max-h-none overflow-auto bg-black/40 scrollbar-thin scrollbar-thumb-white/10"
                        : "rounded-2xl border border-white/10 bg-black/40 overflow-auto scrollbar-thin scrollbar-thumb-white/10",
                    maxHeightClass,
                ].join(" ")}
            >
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
        );

        return (
            <div className="space-y-4">
                <div className="flex justify-end items-center gap-2 pr-2">
                    <button
                        type="button"
                        onClick={() => setIsTableFullscreen(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800/50 border border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/10 text-[10px] font-bold text-white/70 uppercase transition-all shadow-lg active:scale-95"
                    >
                        <Maximize2 className="h-3 w-3 text-emerald-400" />
                        Fullscreen
                    </button>

                    <div className="relative group/menu">
                        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800/50 border border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/10 text-[10px] font-bold text-white/70 uppercase transition-all shadow-lg active:scale-95">
                            <LayoutGrid className="h-3 w-3 text-emerald-400" />
                            Columns ({visibleKeys.size}/{keys.length})
                        </button>
                        
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

                {renderArrayTable()}

                <TableFullscreenModal
                    isOpen={isTableFullscreen}
                    onClose={() => setIsTableFullscreen(false)}
                    title="Debug Table"
                >
                    {renderArrayTable("h-full", true)}
                </TableFullscreenModal>
            </div>
        );
    }

    if (typeof data === "object") {
        const keys = Object.keys(data);
        if (keys.length === 0) return <div className="text-xs text-white/40 italic">Empty object</div>;

        const pricingKeywords = ["matched_cars", "similar_vehicles", "references", "pricing_data", "similar_cars", "analogs"];
        const pricingKey = keys.find(k => pricingKeywords.includes(k.toLowerCase()));

        return (
            <div className="space-y-4">
                {pricingKey && (
                    <div className="space-y-2">
                        <div className="text-[10px] font-bold text-emerald-400/80 uppercase tracking-widest flex items-center gap-1.5">
                            <Car className="h-3 w-3" />
                            Vehicles Used for Pricing
                        </div>
                        <DebugTable data={data[pricingKey]} />
                    </div>
                )}

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

    return <div className="text-xs text-white/90">{renderVal(data)}</div>;
}
