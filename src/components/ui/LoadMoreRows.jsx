"use client";

import React, { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";

// Put at the end of an All table: loads the next rows as it scrolls into view (inside
// a scrolling table too), with a button for when that can't be detected.
export default function LoadMoreRows({ hasMore, loading = false, failed = false, onLoadMore, loadedCount = 0, className = "" }) {
    const marker = useRef(null);

    useEffect(() => {
        // After a failure it waits for the button, rather than retrying on its own.
        if (!hasMore || loading || failed || typeof IntersectionObserver === "undefined" || !marker.current) return undefined;
        // Watched afresh after every load, so a marker that is still in view asks again.
        const observer = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) onLoadMore();
        }, { rootMargin: "600px 0px" });
        observer.observe(marker.current);
        return () => observer.disconnect();
    }, [hasMore, loading, failed, onLoadMore, loadedCount]);

    if (!hasMore) return null;
    return (
        <div ref={marker} className={["flex flex-col items-center gap-1.5 py-3", className].join(" ")}>
            {failed && <span role="alert" className="text-xs text-rose-300">Couldn&apos;t load more rows.</span>}
            <button
                type="button"
                onClick={onLoadMore}
                disabled={loading}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 px-4 text-xs font-bold text-white/60 hover:bg-white/10 disabled:opacity-60 sm:h-8"
            >
                {loading ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading more…</> : failed ? "Try again" : "Load more"}
            </button>
        </div>
    );
}
