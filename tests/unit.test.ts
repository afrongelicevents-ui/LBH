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

// ---------- camera-only capture, offline provenance, sign-up redirect ----------
import { captureProvenance, parseUploadRefs, MAX_OFFLINE_AGE_MS } from "@/lib/uploads";
import { safeNextPath, signupSchema } from "@/lib/signup";

describe("capture provenance", () => {
  const noExif = { takenAt: null, gpsLat: null, gpsLng: null };
  const now = Date.parse("2026-11-07T12:00:00Z");

  it("field staff must use the in-app camera", () => {
    const ref = { path: "x", name: "a.jpg", type: "image/jpeg", source: "upload" as const };
    expect(() => captureProvenance(ref, noExif, { requireCamera: true, now })).toThrow("camera required");
  });

  it("keeps the ORIGINAL capture time + GPS of a photo saved offline", () => {
    const capturedAt = "2026-11-05T08:30:00.000Z"; // two days offline
    const p = captureProvenance(
      { path: "x", name: "a.jpg", type: "image/jpeg", source: "camera", capturedAt, lat: -17.9, lng: 31.04, accuracy: 8 },
      noExif,
      { requireCamera: true, now }
    );
    expect(p).toEqual({ takenAt: capturedAt, gpsLat: -17.9, gpsLng: 31.04, accuracy: 8, source: "camera" });
  });

  it("refuses capture times in the future or too old", () => {
    const mk = (t: number) => ({ path: "x", name: "a", type: "image/jpeg", source: "camera" as const, capturedAt: new Date(t).toISOString() });
    expect(() => captureProvenance(mk(now + 60 * 60 * 1000), noExif, { requireCamera: true, now })).toThrow("capture time");
    expect(() => captureProvenance(mk(now - MAX_OFFLINE_AGE_MS - 1000), noExif, { requireCamera: true, now })).toThrow("capture time");
  });

  it("admin file uploads still use EXIF", () => {
    const takenAt = new Date("2026-11-01T10:00:00Z");
    const p = captureProvenance({ path: "x", name: "a", type: "image/jpeg" }, { takenAt, gpsLat: 1, gpsLng: 2 }, { requireCamera: false, now });
    expect(p.source).toBe("upload");
    expect(p.takenAt).toBe(takenAt.toISOString());
  });

  it("upload references drop malformed GPS / ids", () => {
    const [r] = parseUploadRefs(
      JSON.stringify([{ path: "p", name: "n", type: "image/jpeg", source: "camera", lat: 200, lng: 31, clientRef: "nope", capturedAt: "bad" }])
    );
    expect(r).toMatchObject({ source: "camera", lat: null, lng: null, clientRef: null, capturedAt: null });
  });
});

describe("sign-up", () => {
  it("only same-site paths are accepted after confirmation", () => {
    expect(safeNextPath("/sn/portal")).toBe("/sn/portal");
    expect(safeNextPath("https://evil.example")).toBe("/portal");
    expect(safeNextPath("//evil.example")).toBe("/portal");
    expect(safeNextPath("/\\evil.example")).toBe("/portal");
    expect(safeNextPath("/\t/evil.example/x")).toBe("/portal");
    expect(safeNextPath("/\n/evil.example")).toBe("/portal");
    expect(safeNextPath("/.//evil.example")).toBe("/portal");
    expect(safeNextPath("/a/..//evil.example")).toBe("/portal");
    expect(safeNextPath("/%2e//evil.example")).toBe("/portal");
    expect(safeNextPath("/sn/portal?welcome=1")).toBe("/sn/portal?welcome=1");
  });

  it("requires matching passwords of 10+ characters and accepted terms", () => {
    const base = {
      full_name: "Tatenda Moyo",
      email: "T@Example.com",
      whatsapp: "+44 7700 900123",
      country: "uk",
      password: "long-enough-1",
      confirm_password: "long-enough-1",
      terms: "on",
    };
    const ok = signupSchema.safeParse(base);
    expect(ok.success && ok.data.email).toBe("t@example.com");
    expect(signupSchema.safeParse({ ...base, confirm_password: "different-1" }).success).toBe(false);
    expect(signupSchema.safeParse({ ...base, password: "short", confirm_password: "short" }).success).toBe(false);
    expect(signupSchema.safeParse({ ...base, terms: undefined }).success).toBe(false);
  });
});

// ---------- country: "Other" means typing the real country ----------
import { resolveCountry, cleanCountryName } from "@/lib/country";
import { bookingSchema } from "@/lib/booking";

describe("country of residence", () => {
  it("stores the code for listed countries and the typed name for Other", () => {
    expect(resolveCountry({ country: "uk" })).toBe("uk");
    expect(resolveCountry({ country: "other", country_other: "  botswana " })).toBe("Botswana");
    expect(cleanCountryName("united   arab emirates")).toBe("United Arab Emirates");
    expect(resolveCountry({ country: "other", country_other: "Côte d'Ivoire" })).toBe("Côte d'Ivoire");
  });

  it("Other without a real country name is refused", () => {
    expect(resolveCountry({ country: "other", country_other: "" })).toBeNull();
    expect(resolveCountry({ country: "other", country_other: "<script>" })).toBeNull();
    const base = {
      name: "Test Person",
      email: "t@example.com",
      whatsapp: "+44 7700 900123",
      service: "land",
      slot: "morning",
      callType: "phone",
    };
    const bad = bookingSchema.safeParse({ ...base, country: "other", country_other: "" });
    expect(bad.success).toBe(false);
    expect(bad.success ? "" : bad.error.issues[0].path[0]).toBe("country_other");
    expect(bookingSchema.safeParse({ ...base, country: "other", country_other: "Canada" }).success).toBe(true);
  });
});
