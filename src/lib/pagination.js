// Phase K.48 — page sizes for every paginated table, including "All".
//
// "All" never asks the server for everything at once: the table loads the rows that
// match its current filters, search and sort in chunks of ALL_CHUNK_SIZE, the next one
// only when the reader scrolls near the end. So it stays one continuous table without
// pulling a 20,000-row result into the browser in one go.

export const ALL = "all";
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, ALL];

// The most a list endpoint returns per request (operations MAX_LIST_LIMIT, Parts MAX_PAGE_SIZE).
export const ALL_CHUNK_SIZE = 200;

export const isAll = (pageSize) => pageSize === ALL;

export function parsePageSize(raw, options = PAGE_SIZE_OPTIONS) {
    if (raw === ALL || raw === String(ALL)) return options.includes(ALL) ? ALL : null;
    const n = Number(raw);
    return options.includes(n) ? n : null;
}

export const pageSizeLabel = (option) => (option === ALL ? "All" : String(option));

// "Showing 26–50 of 437 vehicles", "Showing all 437 of 437 vehicles",
// or, while All is still loading as you scroll, "Showing 200 of 437 vehicles".
export function showingLabel({ pageSize, page = 0, shown, total, noun = "row", plural }) {
    const nouns = total === 1 ? noun : (plural || `${noun}s`);
    if (!total) return `No ${plural || `${noun}s`}`;
    if (isAll(pageSize)) {
        return shown >= total ? `Showing all ${total} of ${total} ${nouns}` : `Showing ${shown} of ${total} ${nouns}`;
    }
    const start = page * pageSize;
    return `Showing ${start + 1}–${Math.min(start + shown, total)} of ${total} ${nouns}`;
}
