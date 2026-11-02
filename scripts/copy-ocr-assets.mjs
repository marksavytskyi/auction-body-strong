// Serves the VIN reader's files from our own domain, so scanning needs no third-party CDN.
// Only the scanner requests them; they are never part of a page's bundle.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const target = join(process.cwd(), "public", "vin-ocr");
mkdirSync(target, { recursive: true });

const root = (name) => dirname(require.resolve(`${name}/package.json`));
const files = [
    [join(root("tesseract.js"), "dist", "worker.min.js"), "worker.min.js"],
    [join(root("@tesseract.js-data/eng"), "4.0.0_best_int", "eng.traineddata.gz"), "eng.traineddata.gz"],
    ...["tesseract-core-lstm.wasm.js", "tesseract-core-simd-lstm.wasm.js", "tesseract-core-relaxedsimd-lstm.wasm.js"].map((name) => [
        join(root("tesseract.js-core"), name), name,
    ]),
];
for (const [from, name] of files) copyFileSync(from, join(target, name));
