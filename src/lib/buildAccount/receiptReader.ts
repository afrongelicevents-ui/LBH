import "server-only";
import path from "node:path";
import { parseReceiptText, type ParsedReceipt } from "./parseReceipt";

/**
 * Reads a receipt photo. Swappable: choose with RECEIPT_READER
 * ("tesseract" = free OCR on our own server, the default). Another OCR /
 * vision service can be added by implementing ReceiptReader and adding it
 * to READERS — the rest of the app only sees ParsedReceipt.
 */
export interface ReceiptReader {
  name: string;
  read(image: Buffer): Promise<{ text: string; parsed: ParsedReceipt }>;
}

const READ_TIMEOUT_MS = 35_000;

const tesseractReader: ReceiptReader = {
  name: "tesseract",
  async read(image) {
    const { createWorker } = await import("tesseract.js");
    // Language data ships with the app (no download at run time). Not require.resolve:
    // in the bundled server that returns a module number, not a file path.
    const langPath = path.join(process.cwd(), "node_modules", "@tesseract.js-data", "eng", "4.0.0");
    const worker = await createWorker("eng", 1, { langPath, cacheMethod: "none", gzip: true });
    try {
      // Never keep the person waiting: if reading takes too long they type the details.
      const { data } = await Promise.race([
        worker.recognize(image),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("reading took too long")), READ_TIMEOUT_MS)),
      ]);
      return { text: data.text, parsed: parseReceiptText(data.text) };
    } finally {
      await worker.terminate().catch(() => undefined);
    }
  },
};

const READERS: Record<string, ReceiptReader> = { tesseract: tesseractReader };

export function receiptReader(): ReceiptReader {
  return READERS[process.env.RECEIPT_READER ?? "tesseract"] ?? tesseractReader;
}
