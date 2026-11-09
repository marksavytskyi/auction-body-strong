"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ALL_CHUNK_SIZE, isAll } from "@/lib/pagination";

// Rows for a server-paginated table, one page at a time or, with All, in chunks.
//
// fetchPage(limit, offset) returns { items, total } with the table's filters, search
// and sort already applied, so All shows exactly what the pages would, in the same
// order. Give it a new fetchPage whenever those change: the table starts again from
// the top. refreshKey reloads in place, keeping as many rows as were loaded.
export default function usePagedRows({ fetchPage, pageSize, page = 0, refreshKey, getKey = (row) => row.id, chunkSize = ALL_CHUNK_SIZE }) {
    const all = isAll(pageSize);
    const [rows, setRows] = useState(null);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState(null);
    const [loadMoreFailed, setLoadMoreFailed] = useState(false);

    // A slower earlier response must not overwrite what was asked for last.
    const latest = useRef(0);
    const loaded = useRef(0);
    const busy = useRef(false);
    const reloading = useRef(true);

    const fetchRows = useCallback(async (count) => {
        if (!all) return fetchPage(pageSize, page * pageSize);
        const items = [];
        let reported = 0;
        do {
            const data = await fetchPage(chunkSize, items.length);
            const chunk = Array.isArray(data?.items) ? data.items : [];
            items.push(...chunk);
            reported = data?.total ?? 0;
            if (chunk.length < chunkSize) break;
        } while (items.length < Math.min(count, reported));
        return { items, total: reported };
    }, [all, chunkSize, fetchPage, page, pageSize]);

    const load = useCallback(async ({ keep = false } = {}) => {
        const request = ++latest.current;
        reloading.current = true;
        setLoading(true);
        setError(null);
        setLoadMoreFailed(false);
        try {
            const data = await fetchRows(keep ? Math.max(loaded.current, chunkSize) : chunkSize);
            if (request !== latest.current) return;
            const items = Array.isArray(data?.items) ? data.items : [];
            loaded.current = items.length;
            setRows(items);
            setTotal(data?.total ?? 0);
        } catch (e) {
            if (request !== latest.current) return;
            setError(e);
            setRows(null);
        } finally {
            if (request === latest.current) {
                reloading.current = false;
                setLoading(false);
            }
        }
    }, [chunkSize, fetchRows]);

    useEffect(() => { load(); }, [load]);

    const firstRefresh = useRef(true);
    useEffect(() => {
        if (firstRefresh.current) {
            firstRefresh.current = false;
            return;
        }
        load({ keep: true });
        // Only a refresh: a change of filters already reloads through load.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refreshKey]);

    // Not while reloading: the rows on screen may still be another page size's, or
    // another filter's, and their count is not where the next chunk starts.
    const hasMore = all && !loading && Array.isArray(rows) && rows.length < total;

    const loadMore = useCallback(async () => {
        if (!hasMore || busy.current || reloading.current) return;
        busy.current = true;
        const request = latest.current;
        setLoadingMore(true);
        setLoadMoreFailed(false);
        try {
            const data = await fetchPage(chunkSize, loaded.current);
            if (request !== latest.current) return;
            const chunk = Array.isArray(data?.items) ? data.items : [];
            setRows((previous) => {
                // Rows added while scrolling can shift an offset; never show one twice.
                const seen = new Set(previous.map(getKey));
                const next = [...previous, ...chunk.filter((row) => !seen.has(getKey(row)))];
                loaded.current = next.length;
                return next;
            });
            setTotal(data?.total ?? 0);
            if (chunk.length === 0) setTotal(loaded.current);
        } catch {
            // The rows already shown stay; the reader can try again.
            if (request === latest.current) setLoadMoreFailed(true);
        } finally {
            busy.current = false;
            setLoadingMore(false);
        }
    }, [chunkSize, fetchPage, getKey, hasMore]);

    return { rows, total, loading, loadingMore, loadMoreFailed, error, hasMore, loadMore, reload: load };
}
