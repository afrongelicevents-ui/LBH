import { describe, expect, it } from "vitest";
import { formatCents, depositSplit, parseDollarsToCents } from "../src/lib/money";
import { distanceMeters, FAR_PHOTO_THRESHOLD_M } from "../src/lib/geo";
import { paynowHash, verifyPaynowMessage, normalizePaynowStatus } from "../src/lib/paynow";

describe("money", () => {
  it("formats cents as USD", () => {
    expect(formatCents(42000)).toBe("$420.00");
    expect(formatCents(1)).toBe("$0.01");
  });

  it("splits deposits rounding up (LBH never under-collects the deposit)", () => {
    expect(depositSplit(10001, 50)).toEqual({ deposit: 5001, balance: 5000 });
    expect(depositSplit(42000, 50)).toEqual({ deposit: 21000, balance: 21000 });
  });

  it("parses dollar inputs safely", () => {
    expect(parseDollarsToCents("12.50")).toBe(1250);
    expect(parseDollarsToCents("$1,234.99")).toBe(123499);
    expect(parseDollarsToCents("12.345")).toBeNull();
    expect(parseDollarsToCents("abc")).toBeNull();
    expect(parseDollarsToCents("-5")).toBe(500); // sign stripped, treated as 5.00
  });
});

describe("geo", () => {
  it("computes haversine distance", () => {
    // Harare CBD → Harare South ≈ 11–13 km
    const d = distanceMeters(-17.8292, 31.0522, -17.9257, 31.0405);
    expect(d).toBeGreaterThan(9000);
    expect(d).toBeLessThan(14000);
  });

  it("flags beyond 300 m", () => {
    const near = distanceMeters(-17.92, 31.04, -17.921, 31.04); // ~111 m
    expect(near).toBeLessThan(FAR_PHOTO_THRESHOLD_M);
    const far = distanceMeters(-17.92, 31.04, -17.93, 31.04); // ~1.1 km
    expect(far).toBeGreaterThan(FAR_PHOTO_THRESHOLD_M);
  });
});

describe("paynow", () => {
  const KEY = "test-integration-key";

  it("produces an uppercase SHA512 hash of values + key", () => {
    const h = paynowHash(["a", "b", "c"], KEY);
    expect(h).toMatch(/^[0-9A-F]{128}$/);
    expect(paynowHash(["a", "b", "c"], KEY)).toBe(h);
    expect(paynowHash(["a", "b", "d"], KEY)).not.toBe(h);
  });

  it("verifies a correctly-signed message and rejects tampering", () => {
    const params: Record<string, string> = {
      reference: "LBH-1001-DEP-abc",
      paynowreference: "123456",
      amount: "210.00",
      status: "Paid",
    };
    params.hash = paynowHash(Object.values(params), KEY);
    expect(verifyPaynowMessage(params, KEY)).toBe(true);

    const tampered = { ...params, amount: "1.00" };
    expect(verifyPaynowMessage(tampered, KEY)).toBe(false);

    const noHash: Record<string, string> = { reference: "x" };
    expect(verifyPaynowMessage(noHash, KEY)).toBe(false);
  });

  it("normalizes Paynow statuses", () => {
    expect(normalizePaynowStatus("Paid")).toBe("paid");
    expect(normalizePaynowStatus("Awaiting Delivery")).toBe("awaiting_delivery");
    expect(normalizePaynowStatus("Cancelled")).toBe("cancelled");
    expect(normalizePaynowStatus("???")).toBe("unknown");
    expect(normalizePaynowStatus(undefined)).toBe("unknown");
  });
});

describe("upload type sniffing (magic bytes, not the browser's label)", async () => {
  const { sniffType } = await import("../src/lib/uploads");
  const pad = (b: number[]) => Buffer.concat([Buffer.from(b), Buffer.alloc(16)]);

  it("detects real file types", () => {
    expect(sniffType(pad([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffType(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffType(Buffer.from("%PDF-1.7 rest of file"))).toBe("application/pdf");
    expect(sniffType(Buffer.from("\0\0\0\x18ftypqt  0000", "latin1"))).toBe("video/quicktime");
    expect(sniffType(Buffer.from("\0\0\0\x18ftypisom0000", "latin1"))).toBe("video/mp4");
    expect(sniffType(Buffer.from("\0\0\0\x18ftypheic0000", "latin1"))).toBe("image/heic");
  });

  it("rejects HTML/script disguised as an image", () => {
    expect(sniffType(Buffer.from("<html><script>alert(1)</script></html>"))).toBeNull();
  });
});
