// Formatting for CatDBSnapshotItem price_min/price_max/currency — CatDB
// shows either a range, a single exact amount, or no price at all for a
// given catalyst. This NEVER computes an average/midpoint: an exact price
// is price_min === price_max (a zero-width range), everything else is
// either a real range or "no price available". See backend
// app/catdb/models.py CatDBSnapshotItem docstring for the source contract
// this mirrors exactly.

function fmtAmount(n, currency) {
    try {
        return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD", maximumFractionDigits: 0 }).format(n);
    } catch {
        return `$${Math.round(n)}`;
    }
}

export function formatCatdbPriceRange({ price_min, price_max, currency } = {}) {
    const hasMin = price_min !== null && price_min !== undefined && Number.isFinite(Number(price_min));
    const hasMax = price_max !== null && price_max !== undefined && Number.isFinite(Number(price_max));

    if (!hasMin && !hasMax) return "—";
    if (hasMin && hasMax && Number(price_min) === Number(price_max)) return fmtAmount(Number(price_min), currency);
    if (hasMin && hasMax) return `${fmtAmount(Number(price_min), currency)} – ${fmtAmount(Number(price_max), currency)}`;
    // Only one side present — show whichever we actually have, never guess the other.
    return fmtAmount(Number(hasMin ? price_min : price_max), currency);
}
