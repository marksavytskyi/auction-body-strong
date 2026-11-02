import { describe, expect, it } from "vitest";

import {
    checkDigitValid,
    computeCheckDigit,
    createVinConsensus,
    extractVinCandidates,
    extractVinFromBarcode,
    isConfidentReading,
    normalizeVin,
    validateVin,
} from "../vin";

const GOOD = "1GNSKCKC8HR225261";
const FAILS_CHECK = "1FTFW1EG8JFC12345";

describe("normalizeVin", () => {
    it.each([
        ["1gnskckc8hr225261", GOOD],
        [" 1GNSK CKC8H R225261 ", GOOD],
        ["1GNSK-CKC8H-R225261", GOOD],
        ["1GNSK.CKC8H_R225261", GOOD],
        ["", ""],
        [null, ""],
    ])("%s", (raw, expected) => expect(normalizeVin(raw)).toBe(expected));
});

describe("validateVin", () => {
    it("accepts a good VIN", () => {
        expect(validateVin(GOOD)).toMatchObject({ vin: GOOD, valid: true, errors: [], checkDigitOk: true });
    });

    it("says how long a wrong length is", () => {
        const result = validateVin("ABC");
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toMatch(/17 characters. This has 3/);
    });

    it.each([["I"], ["O"], ["Q"]])("refuses %s and suggests what it may be", (letter) => {
        const result = validateVin(`1GNSKCKC8HR22526${letter}`);
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain(letter);
        expect(result.errors[0]).toMatch(/1 or 0/);
    });

    it("refuses other characters", () => {
        expect(validateVin("1GNSKCKC8HR22526*").valid).toBe(false);
    });

    it("does not refuse a VIN that fails the check digit, because real vehicles do", () => {
        expect(validateVin(FAILS_CHECK)).toMatchObject({ valid: true, checkDigitOk: false, errors: [] });
        expect(validateVin("JTDKN3DU2B1585258")).toMatchObject({ valid: true, checkDigitOk: false });
    });
});

describe("check digit", () => {
    it.each([["1HGBH41JXMN109186", "X"], [GOOD, "8"]])("%s", (vin, digit) => {
        expect(computeCheckDigit(vin)).toBe(digit);
        expect(checkDigitValid(vin)).toBe(true);
    });
});

describe("extractVinCandidates", () => {
    const vins = (text) => extractVinCandidates(text).map((c) => c.vin);

    it("finds a clean reading", () => {
        expect(extractVinCandidates(GOOD)[0]).toMatchObject({ vin: GOOD, checkDigitOk: true, corrections: 0 });
    });

    it("finds a VIN among other label text", () => {
        expect(vins(`MFD BY GM\nGVWR 7000 LB\nVIN: ${GOOD}\nTYPE MPV`)).toContain(GOOD);
    });

    it("ignores the label words in front of it", () => {
        expect(vins(`VEHICLE IDENTIFICATION NO ${GOOD}`)[0]).toBe(GOOD);
        expect(vins(`V.I.N. ${GOOD}`)[0]).toBe(GOOD);
    });

    it("joins a reading broken by spaces", () => {
        expect(vins("1GNSK CKC8H R2252 61")[0]).toBe(GOOD);
    });

    it("turns O, I and Q into what they must be, and records the change", () => {
        const [first] = extractVinCandidates("1GNSKCKC8HR225261".replace("2", "2").replace("1G", "IG"));
        expect(first.vin).toBe(GOOD);
        expect(first.corrections).toBe(1);
        expect(vins("1GNSKCKC8HR225261".replace(/2/g, "2"))).toContain(GOOD);
    });

    it("offers a look-alike that fixes the check digit, marked as changed", () => {
        const misread = `${GOOD.slice(0, 3)}5${GOOD.slice(4)}`; // S read as 5
        const found = extractVinCandidates(misread).find((c) => c.vin === GOOD);
        expect(found).toMatchObject({ checkDigitOk: true, corrections: 1 });
    });

    it("recovers from one stray extra character", () => {
        const stray = `1GNSK5CKC8HR225261`;
        expect(vins(stray)).toContain(GOOD);
    });

    it("does not treat a cut of a slightly longer line as certain", () => {
        const found = extractVinCandidates(`A${GOOD}`).find((c) => c.vin === GOOD);
        expect(found.corrections).toBeGreaterThan(0);
        expect(isConfidentReading(found)).toBe(false);
    });

    it("keeps the literal reading of a VIN that fails the check digit", () => {
        expect(vins(FAILS_CHECK)).toContain(FAILS_CHECK);
    });

    it("never lets a guess push the literal reading off a short list", () => {
        const top = extractVinCandidates(FAILS_CHECK).slice(0, 4).map((c) => c.vin);
        expect(top[0]).toBe(FAILS_CHECK);
    });

    it("finds nothing in unrelated text", () => {
        expect(vins("GVWR 7000 LB\nFRONT GAWR")).toEqual([]);
        expect(vins("")).toEqual([]);
        expect(vins(null)).toEqual([]);
    });
});

describe("isConfidentReading", () => {
    it("needs the check digit to pass with nothing changed", () => {
        expect(isConfidentReading({ checkDigitOk: true, corrections: 0 })).toBe(true);
        expect(isConfidentReading({ checkDigitOk: true, corrections: 1 })).toBe(false);
        expect(isConfidentReading({ checkDigitOk: false, corrections: 0 })).toBe(false);
        expect(isConfidentReading({ fromBarcode: true, checkDigitOk: false, corrections: 0 })).toBe(true);
        expect(isConfidentReading(undefined)).toBe(false);
    });
});

describe("extractVinFromBarcode", () => {
    it("reads an exact payload", () => {
        expect(extractVinFromBarcode(GOOD)).toMatchObject({ vin: GOOD, fromBarcode: true, checkDigitOk: true });
    });

    it("finds a VIN inside a longer payload by its check digit", () => {
        expect(extractVinFromBarcode(`I${GOOD}`).vin).toBe(GOOD);
    });

    it("keeps an exact VIN that fails the check digit", () => {
        expect(extractVinFromBarcode(FAILS_CHECK)).toMatchObject({ vin: FAILS_CHECK, checkDigitOk: false });
    });

    it("never corrects a barcode's characters", () => {
        expect(extractVinFromBarcode("1GNSKCKC8HR22526I")).toBeNull();
    });

    it("ignores barcodes that aren't VINs", () => {
        expect(extractVinFromBarcode("https://example.com")).toBeNull();
        expect(extractVinFromBarcode("12345")).toBeNull();
    });
});

describe("createVinConsensus", () => {
    const certain = { vin: GOOD, checkDigitOk: true, corrections: 0 };
    const uncertain = { vin: FAILS_CHECK, checkDigitOk: false, corrections: 0 };

    it("has nothing ready at first", () => {
        expect(createVinConsensus().ready()).toEqual([]);
    });

    it("is ready at once on a clean check digit", () => {
        const consensus = createVinConsensus();
        consensus.add([certain]);
        expect(consensus.ready()[0].vin).toBe(GOOD);
    });

    it("waits for a second matching frame on an uncertain reading", () => {
        const consensus = createVinConsensus();
        consensus.add([uncertain]);
        expect(consensus.ready()).toEqual([]);
        consensus.add([uncertain]);
        expect(consensus.ready()[0].vin).toBe(FAILS_CHECK);
    });

    it("lists the others alongside what is ready", () => {
        const consensus = createVinConsensus();
        consensus.add([uncertain]);
        consensus.add([certain]);
        expect(consensus.ready().map((c) => c.vin)).toEqual([GOOD, FAILS_CHECK]);
    });

    it("starts over after reset", () => {
        const consensus = createVinConsensus();
        consensus.add([certain]);
        consensus.reset();
        expect(consensus.ready()).toEqual([]);
    });
});
