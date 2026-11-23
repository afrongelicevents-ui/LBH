/**
 * Build step: copy the receipt-reading (OCR) files to public/ocr so phones can
 * read receipts themselves (see src/components/buildAccount/ScanReceipt.tsx).
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const out = join(process.cwd(), "public", "ocr");
mkdirSync(out, { recursive: true });
const nm = join(process.cwd(), "node_modules");
const files = [
  ["tesseract.js/dist/worker.min.js", "worker.min.js"],
  ["tesseract.js-core/tesseract-core-lstm.wasm.js", "tesseract-core-lstm.wasm.js"],
  ["tesseract.js-core/tesseract-core-simd-lstm.wasm.js", "tesseract-core-simd-lstm.wasm.js"],
  ["tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js", "tesseract-core-relaxedsimd-lstm.wasm.js"],
  ["@tesseract.js-data/eng/4.0.0/eng.traineddata.gz", "eng.traineddata.gz"],
];
for (const [from, to] of files) copyFileSync(join(nm, from), join(out, to));
console.log(`[ocr] copied ${files.length} files to public/ocr`);
