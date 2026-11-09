"use client";

import { useCallback, useState } from "react";

import { PAGE_SIZE_OPTIONS, parsePageSize } from "@/lib/pagination";

const read = (key, options) => {
    if (typeof window === "undefined") return null;
    try {
        return parsePageSize(window.localStorage.getItem(key), options);
    } catch {
        return null;
    }
};

// The page size a table was last left on, so choosing All in a batch's vehicles and
// coming back from a vehicle keeps All. One key per table.
export default function usePageSize(storageKey, fallback, options = PAGE_SIZE_OPTIONS) {
    const [pageSize, setState] = useState(() => read(storageKey, options) ?? fallback);
    const setPageSize = useCallback((next) => {
        setState(next);
        try {
            window.localStorage.setItem(storageKey, String(next));
        } catch {
            // Private mode or a full quota: the choice still applies, it just isn't remembered.
        }
    }, [storageKey]);
    return [pageSize, setPageSize];
}
