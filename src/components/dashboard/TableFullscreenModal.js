"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { createPortal } from "react-dom";

export default function TableFullscreenModal({ isOpen, onClose, title = "Table", children }) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    useEffect(() => {
        if (!isOpen) return;

        const onEscape = (event) => {
            if (event.key === "Escape") onClose();
        };

        document.addEventListener("keydown", onEscape);
        return () => document.removeEventListener("keydown", onEscape);
    }, [isOpen, onClose]);

    useEffect(() => {
        if (!isOpen || typeof document === "undefined") return;

        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        return () => {
            document.body.style.overflow = prevOverflow;
        };
    }, [isOpen]);

    const modalNode = useMemo(
        () => (
            <AnimatePresence>
                {isOpen ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[9999] h-[100dvh] w-[100vw] bg-black/90 backdrop-blur-md"
                        onClick={onClose}
                    >
                        <motion.div
                            initial={{ opacity: 0, y: 12, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.98 }}
                            transition={{ duration: 0.2 }}
                            className="h-[100dvh] w-[100vw] bg-[#090b10] overflow-hidden flex flex-col"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className="h-14 shrink-0 flex items-center justify-between px-4 sm:px-5 border-b border-white/10 bg-white/[0.04]">
                                <div className="text-sm sm:text-base font-semibold text-white/90 truncate">{title}</div>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="inline-flex items-center justify-center rounded-lg p-2 text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                                    aria-label="Close fullscreen table"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
                        </motion.div>
                    </motion.div>
                ) : null}
            </AnimatePresence>
        ),
        [children, isOpen, onClose, title]
    );

    if (!mounted) return null;

    return createPortal(modalNode, document.body);
}
