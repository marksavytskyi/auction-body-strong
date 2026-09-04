// Normalizes catalytic backend payloads against the REAL production OpenAPI
// contract (verified live against https://api.strongg.us/openapi.json).
// Field names below are read primarily from the confirmed schema names
// (CatalyticLookupResponse, PositionResult/PositionDetail,
// CandidateResult/CandidateDetail, PriceEstimate, PriceTotal). A small
// number of alias fallbacks remain for fields that genuinely differ between
// the lookup endpoint (computed on the fly) and the admin vehicle-key detail
// endpoint (persisted rows), which is a real difference in the backend, not
// a guess.

export function pick(obj, keys, fallback = undefined) {
    if (!obj || typeof obj !== "object") return fallback;
    for (const key of keys) {
        const val = obj[key];
        if (val !== undefined && val !== null) return val;
    }
    return fallback;
}

function num(v, fallback = null) {
    if (v === undefined || v === null) return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}

// PriceTotal / position-level {low_price, expected_price, high_price} both
// normalize to the same {low, expected, high, currency} shape used by
// <PriceRange>.
export function normalizePricing(source, { lowKey = "low", expectedKey = "expected", highKey = "high", currency = "USD" } = {}) {
    if (!source || typeof source !== "object") return null;
    const low = num(source[lowKey]);
    const expected = num(source[expectedKey]);
    const high = num(source[highKey]);
    if (low === null && expected === null && high === null) return null;
    return { low, expected, high, currency: source.currency || currency };
}

// PriceEstimate: { price, low, high, source, confidence, sample_count, currency, updated_at }
export function normalizePriceEstimate(pe) {
    if (!pe || typeof pe !== "object") return null;
    return {
        low: num(pe.low),
        expected: num(pe.price),
        high: num(pe.high),
        currency: pe.currency || "USD",
        source: pe.source || null,
        confidenceScore: num(pe.confidence),
        sampleCount: pe.sample_count ?? null,
        updatedAt: pe.updated_at || null,
    };
}

const CONFIDENCE_ORDER = ["VERY_HIGH", "HIGH", "MEDIUM", "LOW", "UNKNOWN"];

// The lookup response gives an explicit confidence_label (VERY_HIGH / HIGH /
// MEDIUM / LOW / UNKNOWN per the task's own vocabulary) alongside a raw
// 0..1 confidence score. Prefer the label; fall back to deriving one from
// the score only if no label is present.
export function normalizeConfidence(labelOrScore) {
    if (labelOrScore === undefined || labelOrScore === null || labelOrScore === "") return "UNKNOWN";
    if (typeof labelOrScore === "string") {
        const s = labelOrScore.trim().toUpperCase().replace(/[\s-]+/g, "_");
        if (CONFIDENCE_ORDER.includes(s)) return s;
        if (s.includes("VERY") && s.includes("HIGH")) return "VERY_HIGH";
        if (s.includes("HIGH")) return "HIGH";
        if (s.includes("MED")) return "MEDIUM";
        if (s.includes("LOW")) return "LOW";
    }
    const n = Number(labelOrScore);
    if (Number.isFinite(n)) {
        if (n >= 0.9) return "VERY_HIGH";
        if (n >= 0.7) return "HIGH";
        if (n >= 0.4) return "MEDIUM";
        if (n > 0) return "LOW";
    }
    return "UNKNOWN";
}

// The backend's real `source` values observed in production are lowercase
// and sometimes composite, e.g. "catdb", "ecotrade", "catdb+ecotrade",
// "manual". The PriceEstimate carries its own uppercase `source`
// (CATDB / ECOTRADE / OUR_SALES / OUR_OBSERVATION / MANUAL), which is what
// pricing badges should key off. Composite candidate-linkage sources are
// split and humanized rather than guessed at as a single unknown enum value.
const SOURCE_META = {
    OUR_OBSERVATION: { label: "Verified", tone: "verified", hint: "Confirmed by our own physical observation of a dismantled vehicle." },
    OUR_SALES: { label: "Our data", tone: "verified", hint: "Derived from our own recorded sales history." },
    CATDB: { label: "CatDB", tone: "external", hint: "Reference pricing from the CatDB external database." },
    ECOTRADE: { label: "Ecotrade", tone: "external", hint: "Reference pricing from Ecotrade." },
    MANUAL: { label: "Manual", tone: "manual", hint: "Manually entered / corrected by an operator." },
};

function humanizeSourceToken(token) {
    const code = String(token || "").trim().toUpperCase().replace(/[\s-]+/g, "_");
    const meta = SOURCE_META[code];
    if (meta) return meta.label;
    return code.replace(/_/g, " ");
}

export function normalizeSource(raw) {
    if (!raw) return { code: "UNKNOWN", label: "Unknown", tone: "unknown", hint: "Source not reported by the backend." };
    const rawStr = String(raw).trim();
    const parts = rawStr.split("+").map((p) => p.trim()).filter(Boolean);

    if (parts.length > 1) {
        const label = parts.map(humanizeSourceToken).join(" + ");
        const tone = parts.some((p) => SOURCE_META[p.toUpperCase()]?.tone === "verified") ? "verified" : "external";
        return { code: rawStr.toUpperCase(), label, tone, hint: `Linked via ${label}` };
    }

    const code = rawStr.toUpperCase().replace(/[\s-]+/g, "_");
    const meta = SOURCE_META[code];
    if (meta) return { code, ...meta };
    return { code, label: humanizeSourceToken(code), tone: code.includes("OUR") ? "verified" : "external", hint: "" };
}

// CandidateResult (lookup) has no numeric `id`, only `converter_id`.
// CandidateDetail (admin vehicle-key view) has both `id` (used for
// POST /catalytic/candidates/{id}/reject) and `converter_id`.
export function normalizeCandidate(raw) {
    if (!raw || typeof raw !== "object") return null;
    const price = normalizePriceEstimate(raw.price);
    return {
        raw,
        id: raw.id ?? null,
        code: raw.code ?? "—",
        converterId: raw.converter_id ?? null,
        probability: num(raw.probability),
        linkSource: raw.source || null,
        source: normalizeSource(price?.source || raw.source),
        price,
        observedCount: raw.observed_count ?? null,
        rejectedCount: raw.rejected_count ?? null,
        sampleCount: price?.sampleCount ?? raw.observed_count ?? null,
    };
}

// PositionResult (lookup): { position, candidates, expected_price, low_price, high_price } — no id/confidence.
// PositionDetail (admin): { id, position_code, position_order, description, quantity, confidence, candidates }.
export function normalizePosition(raw) {
    if (!raw || typeof raw !== "object") return null;
    const candidates = Array.isArray(raw.candidates) ? raw.candidates.map(normalizeCandidate).filter(Boolean) : [];
    const code = raw.position_code ?? raw.position ?? "unknown";
    const pricing = normalizePricing(raw, { lowKey: "low_price", expectedKey: "expected_price", highKey: "high_price" });
    const topProbability = candidates.reduce((max, c) => (c.probability !== null && c.probability > max ? c.probability : max), 0);

    return {
        raw,
        id: raw.id ?? null,
        code,
        name: code === "unknown" ? "Unspecified Position" : code.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        confidence: raw.confidence !== undefined ? normalizeConfidence(raw.confidence) : null,
        topProbability: candidates.length ? topProbability : null,
        pricing,
        candidates,
    };
}

// CatalyticLookupResponse: { vehicle, catalyst_count, positions, total,
// confidence, confidence_label, is_estimate, sources_used, lookup_duration_ms, cached }
export function normalizeLookupResult(raw) {
    if (!raw || typeof raw !== "object") return null;
    const vehicle = raw.vehicle || {};
    const positions = Array.isArray(raw.positions) ? raw.positions.map(normalizePosition).filter(Boolean) : [];

    return {
        raw,
        vehicleKeyId: vehicle.vehicle_key_id ?? null,
        vehicleKeyStatus: vehicle.vehicle_key_status ?? null,
        vehicleLabel: [vehicle.year, vehicle.make, vehicle.model, vehicle.engine].filter(Boolean).join(" "),
        catalystCount: raw.catalyst_count ?? null,
        confidence: normalizeConfidence(raw.confidence_label ?? raw.confidence),
        confidenceScore: num(raw.confidence),
        isEstimate: Boolean(raw.is_estimate),
        sourcesUsed: Array.isArray(raw.sources_used) ? raw.sources_used : [],
        cached: Boolean(raw.cached),
        totalPricing: normalizePricing(raw.total),
        positions,
    };
}
