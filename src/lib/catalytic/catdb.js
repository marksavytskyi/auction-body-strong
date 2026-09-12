// CatDB is a SEPARATE, independent pricing source from "Our Database".
// As of this writing there is NO backend contract for it anywhere —
// verified against the live production OpenAPI schema (api.strongg.us):
// no /catalytic/catdb* route, no catdb_* field on CatalyticLookupResponse,
// PositionResult, CandidateResult, BatchJobRowResponse, or any other
// schema. A separate backend/Android automation service is expected to
// populate this eventually (Copart VIN -> CatDB Android app -> snapshot
// saved server-side). The frontend must NEVER fabricate a CatDB price,
// status, or timestamp.
//
// ---------------------------------------------------------------------
// EXACT BACKEND CONTRACT THIS FRONTEND IS BUILT TO CONSUME (not built yet):
//
// A CatDB snapshot, wherever it eventually appears (e.g. an additional
// `catdb` field on CatalyticLookupResponse / BatchJobRowResponse.result,
// or a dedicated `GET /catalytic/catdb/{vehicle_key_id}` /
// `GET /catalytic/catdb/vin/{vin}` endpoint), should look like:
//
//   {
//     "status": "NO_DATA" | "PENDING" | "SEARCHING" | "COMPLETE" | "FAILED",
//     "catalyst_count": number | null,
//     "total_price": number | null,
//     "currency": string,                 // default "USD"
//     "captured_at": string | null,       // ISO 8601 timestamp of the snapshot
//     "error": string | null,             // present when status === "FAILED"
//     "catalysts": [                      // present when status === "COMPLETE"
//       {
//         "code": string | null,          // CatDB's own label/code, if supplied
//         "position": string | null,
//         "price": number | null
//       }
//     ]
//   }
//
// A history of snapshots (see product spec section 7) would need either
// `GET /catalytic/catdb/{vehicle_key_id}/history` returning an array of the
// shape above, or the single-snapshot response including a `previous`
// array of past captures. Neither exists yet.
// ---------------------------------------------------------------------

export const CATDB_STATUS = {
    NO_DATA: "NO_DATA",
    PENDING: "PENDING",
    SEARCHING: "SEARCHING",
    COMPLETE: "COMPLETE",
    FAILED: "FAILED",
};

// Looks for a `catdb` field on whatever raw object it's given (a future
// CatalyticLookupResponse or a BatchJobRowResponse.result). Today this
// field never exists in production, so every call returns the NO_DATA /
// contractMissing shape — that's not a bug, it's the honest state until
// the backend ships the contract above.
export function normalizeCatdbSnapshot(raw) {
    const catdb = raw?.catdb;

    if (!catdb || typeof catdb !== "object") {
        return {
            status: CATDB_STATUS.NO_DATA,
            contractMissing: true,
            catalystCount: null,
            totalPrice: null,
            currency: "USD",
            capturedAt: null,
            error: null,
            catalysts: [],
        };
    }

    const status = Object.values(CATDB_STATUS).includes(catdb.status) ? catdb.status : CATDB_STATUS.NO_DATA;

    return {
        status,
        contractMissing: false,
        catalystCount: catdb.catalyst_count ?? null,
        totalPrice: catdb.total_price ?? null,
        currency: catdb.currency || "USD",
        capturedAt: catdb.captured_at || null,
        error: catdb.error || null,
        catalysts: Array.isArray(catdb.catalysts)
            ? catdb.catalysts.map((c) => ({
                  code: c.code ?? null,
                  position: c.position ?? null,
                  price: c.price ?? null,
              }))
            : [],
    };
}
