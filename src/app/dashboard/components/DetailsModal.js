"use client";

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, LayoutGrid, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DetailsModal({ isOpen, data, onClose, children }) {
    useEffect(() => {
        if (!isOpen) return;

        const onEscape = (event) => {
            if (event.key === "Escape") onClose();
        };

        document.addEventListener("keydown", onEscape);
        return () => document.removeEventListener("keydown", onEscape);
    }, [isOpen, onClose]);

    return (
        <AnimatePresence>
            {isOpen ? (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96, y: 12 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.97, y: 10 }}
                        transition={{ duration: 0.22 }}
                        className="relative w-full max-w-6xl max-h-[90vh] overflow-hidden bg-[#0b0d12] rounded-3xl border border-white/10 shadow-2xl flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-4 sm:p-6 border-b border-white/5 bg-white/[0.04]">
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
                                    type="button"
                                    onClick={onClose}
                                    className="absolute top-4 right-4 sm:relative sm:top-auto sm:right-auto p-2 rounded-xl hover:bg-white/10 text-white/40 hover:text-white transition-all active:scale-95"
                                    aria-label="Close details modal"
                                >
                                    <X className="h-6 w-6" />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-white/10">
                            {data ? (
                                children
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12 gap-3 text-white/20">
                                    <AlertCircle className="h-12 w-12" />
                                    <p className="text-sm font-medium">No detailed information available.</p>
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t border-white/5 bg-black/20 flex justify-end">
                            <Button variant="outline" onClick={onClose} className="rounded-xl border-white/10 hover:bg-white/5 text-white font-bold px-6">
                                Close
                            </Button>
                        </div>
                    </motion.div>
                </motion.div>
            ) : null}
        </AnimatePresence>
    );
}
