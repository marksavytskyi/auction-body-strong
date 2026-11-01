// How a Parts value is displayed, decided by what the field means and never by
// the value being numeric. Display only: stored values are not changed.
export const EMPTY_VALUE = "—";

const MONEY_FIELD = /(^|_)(price|cost)(_usd)?$|^(avg|min|max)_.*_price_usd$/;
const PLAIN_ID_FIELD = /^id$|_id$/;
const COUNT_FIELD = /(^|_)(count|candidates|outliers_removed)$/;

export function fieldKind(key) {
    const field = String(key || "").toLowerCase();
    if (MONEY_FIELD.test(field)) return "money";
    if (field === "year") return "year";
    if (field === "disp" || field === "engine_displacement") return "displacement";
    if (field === "mileage" || field === "odometer") return "mileage";
    if (PLAIN_ID_FIELD.test(field)) return "id";
    if (COUNT_FIELD.test(field)) return "count";
    return "text";
}

function asNumber(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value !== "string" || value.trim() === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

export function formatField(value, key) {
    if (value === null || value === undefined || value === "") return EMPTY_VALUE;
    if (typeof value === "number" && !Number.isFinite(value)) return EMPTY_VALUE;
    if (typeof value === "boolean") return value ? "Yes" : "No";

    const kind = fieldKind(key);
    const number = asNumber(value);
    if (number === null || kind === "text" || kind === "id") return String(value);

    switch (kind) {
        case "money":
            return number.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 2 });
        case "year":
            return String(Math.trunc(number));
        case "displacement":
            return number.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
        case "mileage":
        case "count":
            return Math.round(number).toLocaleString("en-US");
        default:
            return String(value);
    }
}
