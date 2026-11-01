"use client";

import React, { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { createPortal } from "react-dom";
import { useModalLayer } from "@/hooks/useModalLayer";

export default function TableFullscreenModal({ isOpen, onClose, title = "Table", children }) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    const zIndex = useModalLayer(isOpen, onClose);

    const modalNode = useMemo(
        () =>
                isOpen ? (
                    <div
                        className="fixed inset-0 h-[100dvh] w-[100vw] bg-black/90"
                        style={{ zIndex }}
                        onClick={onClose}
                    >
                        <div
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
                        </div>
                    </div>
                ) : null,
        [children, isOpen, onClose, title, zIndex]
    );

    if (!mounted) return null;

    return createPortal(modalNode, document.body);
}
