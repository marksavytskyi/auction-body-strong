"use client";

import { useCallback, useMemo, useState } from "react";

// Which columns a table shows, remembered in this browser. Only the choices made are
// stored, so a column added later still starts as its default. Hiding a column only
// hides it: nothing it shows is changed.
export default function useColumnVisibility(storageKey, columns) {
    const read = () => {
        if (typeof window === "undefined") return {};
        try {
            const saved = JSON.parse(window.localStorage.getItem(storageKey) || "{}");
            return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
        } catch {
            return {};
        }
    };
    const [choices, setChoices] = useState(read);

    const save = useCallback((next) => {
        setChoices(next);
        try {
            window.localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
            // Private mode or a full quota: the choice applies, it just isn't remembered.
        }
    }, [storageKey]);

    const isVisible = useCallback((column) => {
        if (column.required) return true;
        return typeof choices[column.id] === "boolean" ? choices[column.id] : column.defaultVisible !== false;
    }, [choices]);

    const visible = useMemo(() => columns.filter(isVisible), [columns, isVisible]);

    const toggle = useCallback((id) => {
        const column = columns.find((c) => c.id === id);
        if (!column || column.required) return;
        save({ ...choices, [id]: !isVisible(column) });
    }, [choices, columns, isVisible, save]);

    const showAll = useCallback(() => save(Object.fromEntries(columns.map((c) => [c.id, true]))), [columns, save]);
    const hideAll = useCallback(() => save(Object.fromEntries(columns.map((c) => [c.id, false]))), [columns, save]);
    const reset = useCallback(() => save({}), [save]);

    return { visible, isVisible, toggle, showAll, hideAll, reset };
}
