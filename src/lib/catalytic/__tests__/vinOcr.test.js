// @vitest-environment node
// The real OCR engine on realistic label images, with no mocks: if recognition regresses,
// this fails. It runs in Node, so a browser's camera and Safari itself are not covered here.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createWorker, PSM } from "tesseract.js";

import { extractVinCandidates, isConfidentReading } from "../vin";

const require = createRequire(import.meta.url);
const langPath = join(dirname(require.resolve("@tesseract.js-data/eng/package.json")), "4.0.0_best_int");
const fixture = (name) => readFileSync(new URL(`./fixtures/vin/${name}.jpg`, import.meta.url));

describe("printed VIN recognition", () => {
    let worker;

    beforeAll(async () => {
        worker = await createWorker("eng", 1, { langPath, gzip: true, cacheMethod: "none", logger: () => {}, errorHandler: () => {} });
        await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
    }, 60000);

    afterAll(() => worker?.terminate());

    it.each([
        ["clean", "1FTFW1EG3JFC12345", "printed label"],
        ["sticker", "1GNSKCKC8HR225261", "door sticker among other text"],
        ["plate", "5YJSA1E22MF123456", "low-contrast dash plate"],
        ["skew", "JTDKB20U593512947", "tilted label"],
        ["blurry", "2T1BURHE4JC074319", "out of focus"],
        ["dim", "KMHD84LF8HU187246", "poor lighting with noise"],
        ["glare", "3VW2B7AJ9HM301875", "glare across the label"],
    ])("%s: %s (%s)", async (name, vin) => {
        const { data } = await worker.recognize(fixture(name));
        const [best] = extractVinCandidates(data.text);
        expect(best?.vin).toBe(vin);
        expect(isConfidentReading(best)).toBe(true);
    }, 30000);

    it("never presents a VIN failing the check digit as certain", async () => {
        const { data } = await worker.recognize(fixture("badcheck"));
        const candidates = extractVinCandidates(data.text);
        expect(candidates.map((c) => c.vin)).toContain("1HGBH41J7MN109187");
        expect(candidates.filter(isConfidentReading)).toEqual([]);
    }, 30000);
});
