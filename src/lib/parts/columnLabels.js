// Display names only. Backend fields, saved column preferences and CSV headers
// keep their raw names everywhere else.
const LABELS = {
    id: "ID",
    vin: "VIN",
    make: "Make",
    model: "Model",
    model_norm: "Model",
    year: "Year",
    price: "Price",
    price_usd: "Price ($)",
    odometer: "Odometer",
    mileage: "Mileage",
    disp: "Engine (L)",
    engine: "Engine",
    transmission: "Transmission",
    color: "Color",
    location: "Location",
    lot_url: "Lot URL",
    auction: "Auction",
    sold_date: "Sold Date",
    final_price: "Final Price",
    avg_price: "Avg Price",
    distance: "Distance",
    score: "Match Score",
    description: "Description",
    avg_engine_price_usd: "Engine Price",
    min_engine_price_usd: "Engine Price Min",
    max_engine_price_usd: "Engine Price Max",
    avg_transmission_price_usd: "Transmission Price",
    min_transmission_price_usd: "Transmission Price Min",
    max_transmission_price_usd: "Transmission Price Max",
    debug_json: "Details",
    pricing_debug_json: "Details",
};

// Copart's own headers ("Lot URL", "Engine type") are already readable, so only
// snake_case fields are rewritten.
export function columnLabel(field) {
    const raw = String(field ?? "");
    const known = LABELS[raw.toLowerCase()];
    if (known) return known;
    if (!raw.includes("_")) return raw && raw === raw.toLowerCase() ? raw.charAt(0).toUpperCase() + raw.slice(1) : raw;
    return raw
        .split("_")
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

export function columnMatches(field, search) {
    const needle = String(search || "").toLowerCase();
    return String(field ?? "").toLowerCase().includes(needle) || columnLabel(field).toLowerCase().includes(needle);
}
