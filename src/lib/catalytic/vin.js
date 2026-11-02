// VIN rules for the capture screens. Pure functions, so the camera has nothing to do with them.
// The server applies the same rules (app/vin.py): a wrong check digit is a warning, not a
// refusal, because real vehicles fail it.

export const VIN_LENGTH = 17;

const ALLOWED = /^[A-HJ-NPR-Z0-9]+$/;
const TRANSLITERATION = {
    A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
    J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
    S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
};
const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
const CHECK_POSITION = 8;

// Characters a camera confuses. Each is tried when a reading fails the check digit.
const LOOK_ALIKE = {
    0: "DU", 1: "L7T", 2: "Z", 3: "E8", 4: "A", 5: "S", 6: "G", 7: "T1Z", 8: "B3S", 9: "G",
    A: "4", B: "8", D: "0", E: "3F", F: "EP", G: "6C", H: "M", K: "X", L: "1", M: "NH", N: "MH",
    P: "F", R: "K", S: "5", T: "7", U: "0V", V: "UY", W: "VN", X: "K", Y: "V", Z: "27",
};

// I, O and Q never appear in a VIN, so a reader that sees one has misread 1 or 0.
const NEVER_IN_A_VIN = { I: "1", O: "0", Q: "0" };

const LABEL_WORDS = /\b(V\.?\s*I\.?\s*N\.?|VIN\s*(NO|NUMBER|#)?|VEHICLE\s+IDENTIFICATION(\s+(NO|NUMBER))?)\b[:#\s]*/g;

export function normalizeVin(raw) {
    return String(raw ?? "").toUpperCase().replace(/[\s\-_.:/]/g, "");
}

export function computeCheckDigit(vin) {
    let sum = 0;
    for (let i = 0; i < VIN_LENGTH; i += 1) {
        const c = vin[i];
        const value = /\d/.test(c) ? Number(c) : TRANSLITERATION[c];
        if (value === undefined) return null;
        sum += value * WEIGHTS[i];
    }
    const remainder = sum % 11;
    return remainder === 10 ? "X" : String(remainder);
}

export function checkDigitValid(vin) {
    return vin.length === VIN_LENGTH && computeCheckDigit(vin) === vin[CHECK_POSITION];
}

export function validateVin(raw) {
    const vin = normalizeVin(raw);
    const errors = [];
    if (vin.length !== VIN_LENGTH) errors.push(`A VIN has ${VIN_LENGTH} characters. This has ${vin.length}.`);
    const prohibited = [...new Set(vin.replace(/[^IOQ]/g, ""))];
    if (prohibited.length) errors.push(`A VIN never contains I, O or Q. Found ${prohibited.join(", ")}. It may be a 1 or 0.`);
    const other = [...new Set(vin.replace(/[A-Z0-9]/g, ""))];
    if (other.length) errors.push(`Remove these characters: ${other.join(" ")}`);
    const valid = errors.length === 0 && ALLOWED.test(vin);
    return { vin, valid, errors, checkDigitOk: valid ? checkDigitValid(vin) : null };
}

export const CHECK_DIGIT_WARNING = "This VIN fails the standard check digit, so check it against the vehicle. Some real vehicles fail this check, so you can still use it.";

// What was actually read comes before anything guessed from it. A real VIN can fail the check
// digit, so a guess that passes must never push the literal reading off a short list.
function byReliability(a, b) {
    return a.corrections - b.corrections || Number(b.checkDigitOk) - Number(a.checkDigitOk) || a.vin.localeCompare(b.vin);
}

function plausibleTail(vin) {
    return /\d{3}$/.test(vin);
}

function repairs(vin) {
    const found = [];
    for (let i = 0; i < VIN_LENGTH; i += 1) {
        for (const replacement of LOOK_ALIKE[vin[i]] || "") {
            const candidate = vin.slice(0, i) + replacement + vin.slice(i + 1);
            if (checkDigitValid(candidate)) found.push(candidate);
        }
    }
    return found;
}

function windowsOf(line) {
    const windows = [];
    for (let i = 0; i + VIN_LENGTH <= line.length; i += 1) windows.push(line.slice(i, i + VIN_LENGTH));
    return windows;
}

// Every VIN a block of recognized text could be, best first. A candidate that needed a
// character changed says so, and nothing here ever accepts one: the worker confirms.
export function extractVinCandidates(text) {
    const best = new Map();
    const add = (vin, corrections) => {
        const current = best.get(vin);
        if (!current || corrections < current.corrections) {
            best.set(vin, { vin, checkDigitOk: checkDigitValid(vin), corrections });
        }
    };

    for (const rawLine of String(text ?? "").toUpperCase().split(/\r?\n/)) {
        const withoutLabel = rawLine.replace(LABEL_WORDS, " ");
        const compact = withoutLabel.replace(/[^A-Z0-9]/g, "");
        const line = compact.replace(/[IOQ]/g, (c) => NEVER_IN_A_VIN[c]);
        const replaced = [...compact].filter((c) => NEVER_IN_A_VIN[c]).length;
        if (line.length < VIN_LENGTH) continue;
        // Cutting a VIN out of a line barely longer than one is a guess: one such cut in
        // eleven passes the check digit by chance.
        const cut = line.length > VIN_LENGTH && line.length <= VIN_LENGTH + 2 ? 1 : 0;
        for (const vin of windowsOf(line)) {
            if (checkDigitValid(vin)) {
                add(vin, replaced + cut);
            } else if (line.length <= VIN_LENGTH + 2) {
                if (plausibleTail(vin)) add(vin, replaced + cut);
                for (const repaired of repairs(vin)) add(repaired, replaced + cut + 1);
            }
        }
        // A camera sometimes reads one stray extra character inside the VIN.
        if (line.length === VIN_LENGTH + 1) {
            for (let i = 0; i < line.length; i += 1) {
                const vin = line.slice(0, i) + line.slice(i + 1);
                if (checkDigitValid(vin)) add(vin, replaced + 1);
            }
        }
    }

    return [...best.values()].sort(byReliability);
}

// A barcode carries exact characters, so nothing is corrected. Labels sometimes prefix an
// extra character, which is why a longer payload is searched rather than refused.
export function extractVinFromBarcode(text) {
    const compact = String(text ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const windows = windowsOf(compact).filter((vin) => ALLOWED.test(vin));
    const chosen = windows.find(checkDigitValid) || (compact.length === VIN_LENGTH ? windows[0] : null);
    return chosen ? { vin: chosen, checkDigitOk: checkDigitValid(chosen), corrections: 0, fromBarcode: true } : null;
}

// A reading the worker can simply confirm: exact characters, or the check digit passing with
// nothing changed. Anything else is one guess among others, so the worker has to choose.
export function isConfidentReading(candidate) {
    return Boolean(candidate?.fromBarcode || (candidate?.checkDigitOk && candidate.corrections === 0));
}

// Frames disagree, so one noisy reading isn't enough to bother the worker with. A reading
// is ready when the check digit passes untouched, or when frames keep agreeing on it.
export function createVinConsensus({ requiredHits = 2 } = {}) {
    const seen = new Map();
    return {
        add(candidates) {
            for (const candidate of candidates) {
                const current = seen.get(candidate.vin);
                seen.set(candidate.vin, {
                    ...candidate,
                    corrections: current ? Math.min(current.corrections, candidate.corrections) : candidate.corrections,
                    hits: (current?.hits || 0) + 1,
                });
            }
        },
        ready() {
            const all = [...seen.values()];
            const isReady = (c) => c.fromBarcode || (c.checkDigitOk && c.corrections === 0) || c.hits >= requiredHits;
            if (!all.some(isReady)) return [];
            return all.sort((a, b) => byReliability(a, b) || b.hits - a.hits).slice(0, 4);
        },
        reset() {
            seen.clear();
        },
    };
}
