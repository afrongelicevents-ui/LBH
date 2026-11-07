import "server-only";
import sharp from "sharp";
import exifReader from "exif-reader";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Upload handling (brief §11):
 *  - strict type/size checks
 *  - images are re-encoded (defuses malicious files) and EXIF is STRIPPED
 *    from what clients see — but GPS + capture time are read server-side
 *    FIRST (brief §6: field photo provenance).
 *  - private buckets only; reads go through short-lived signed URLs after
 *    explicit access checks.
 */

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const DOC_TYPES = [...IMAGE_TYPES, "application/pdf"];
export const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

// Files go browser → Supabase Storage directly (signed upload URLs), so the
// hosting platform's request-body limit (Vercel: 4.5 MB) never applies.
// Supabase's free plan caps a single object at 50 MB.
export const MAX_IMAGE_BYTES = 30 * 1024 * 1024;
export const MAX_DOC_BYTES = 30 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

export interface ImageExif {
  takenAt: Date | null;
  gpsLat: number | null;
  gpsLng: number | null;
}

function gpsToDecimal(
  coord: number[] | undefined,
  ref: string | undefined
): number | null {
  if (!coord || coord.length < 3) return null;
  const dec = coord[0] + coord[1] / 60 + coord[2] / 3600;
  return ref === "S" || ref === "W" ? -dec : dec;
}

/** Read capture time + GPS from EXIF before it is stripped. */
export async function readImageExif(buffer: Buffer): Promise<ImageExif> {
  const out: ImageExif = { takenAt: null, gpsLat: null, gpsLng: null };
  try {
    const meta = await sharp(buffer).metadata();
    if (!meta.exif) return out;
    const exif = exifReader(meta.exif);
    const dt =
      exif.Photo?.DateTimeOriginal ??
      exif.Photo?.DateTimeDigitized ??
      exif.Image?.DateTime;
    if (dt instanceof Date && !Number.isNaN(dt.getTime())) out.takenAt = dt;
    out.gpsLat = gpsToDecimal(
      exif.GPSInfo?.GPSLatitude as number[] | undefined,
      exif.GPSInfo?.GPSLatitudeRef as string | undefined
    );
    out.gpsLng = gpsToDecimal(
      exif.GPSInfo?.GPSLongitude as number[] | undefined,
      exif.GPSInfo?.GPSLongitudeRef as string | undefined
    );
  } catch {
    // Unreadable EXIF is not an error — provenance fields stay null.
  }
  return out;
}

/** Re-encode an image (strips all metadata incl. EXIF) as JPEG. */
export async function reencodeImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer, { failOn: "error" })
    .rotate() // apply EXIF orientation before metadata is dropped
    .jpeg({ quality: 85 })
    .toBuffer();
}

function randomName(ext: string): string {
  return `${crypto.randomUUID()}.${ext}`;
}

/** Store a buffer in a private bucket; returns the storage path. */
export async function storePrivate(
  bucket: "documents" | "media" | "proofs",
  pathPrefix: string,
  buffer: Buffer,
  contentType: string,
  ext: string
): Promise<string> {
  const admin = createAdminClient();
  const path = `${pathPrefix}/${randomName(ext)}`;
  const { error } = await admin.storage
    .from(bucket)
    .upload(path, buffer, { contentType, upsert: false });
  if (error) throw new Error(`upload failed: ${error.message}`);
  return path;
}

/** Short-lived signed URL (caller must have verified access first). */
export async function signedUrl(
  bucket: "documents" | "media" | "proofs",
  path: string,
  expiresInSeconds = 300
): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);
  return data?.signedUrl ?? null;
}

export function extForType(type: string): string {
  switch (type) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "application/pdf":
      return "pdf";
    case "video/mp4":
      return "mp4";
    case "video/quicktime":
      return "mov";
    case "video/webm":
      return "webm";
    default:
      return "bin";
  }
}

// ======================================================================
// Direct uploads: browser → private "incoming" bucket → server finalises
// ======================================================================

export type UploadPurpose = "client-document" | "staff-media" | "quote-file" | "site-photo";

export interface UploadedRef {
  path: string;
  name: string;
  type: string;
  /** "camera" = taken with the in-app camera; "upload" = picked from files */
  source?: "camera" | "upload";
  /** device time at the moment of capture (ISO) — kept even if uploaded later */
  capturedAt?: string | null;
  lat?: number | null;
  lng?: number | null;
  accuracy?: number | null;
  /** id made on the phone at capture: a replayed upload is stored once */
  clientRef?: string | null;
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

export function allowedTypesFor(purpose: UploadPurpose): string[] {
  if (purpose === "site-photo") return IMAGE_TYPES;
  return purpose === "staff-media" ? [...IMAGE_TYPES, ...VIDEO_TYPES] : DOC_TYPES;
}

export function maxBytesFor(type: string): number {
  if (VIDEO_TYPES.includes(type)) return MAX_VIDEO_BYTES;
  if (type === "application/pdf") return MAX_DOC_BYTES;
  return MAX_IMAGE_BYTES;
}

/** Signed one-time upload slot under incoming/<userId>/ (valid ~2h). */
export async function createUploadSlot(
  userId: string,
  type: string
): Promise<{ path: string; token: string }> {
  const admin = createAdminClient();
  const path = `${userId}/${crypto.randomUUID()}.${extForType(type)}`;
  const { data, error } = await admin.storage.from("incoming").createSignedUploadUrl(path);
  if (error || !data) throw new Error(`upload slot failed: ${error?.message}`);
  return { path, token: data.token };
}

/** Real file type from magic bytes (never trust the browser's label). */
export function sniffType(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (buf.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return "video/webm";
  if (buf.subarray(4, 8).toString("latin1") === "ftyp") {
    const brand = buf.subarray(8, 12).toString("latin1");
    if (brand.startsWith("qt")) return "video/quicktime";
    if (/^(heic|heix|hevc|mif1|msf1)/.test(brand)) return "image/heic";
    return "video/mp4";
  }
  return null;
}

export interface TakenFile {
  buffer: Buffer;
  contentType: string;
  ext: string;
  originalName: string;
  isImage: boolean;
  exif: ImageExif;
}

/**
 * Claim a file the browser uploaded to incoming/<userId>/…: verify it
 * belongs to this user, check its REAL type and size, read EXIF (images),
 * re-encode images (strips EXIF), and delete the incoming original.
 */
export async function takeIncoming(
  userId: string,
  ref: UploadedRef,
  purpose: UploadPurpose
): Promise<TakenFile> {
  const re = new RegExp(`^${userId}/${UUID}\\.(jpg|png|webp|pdf|mp4|mov|webm)$`);
  if (!re.test(ref.path)) throw new Error("invalid upload reference");

  const admin = createAdminClient();
  const { data: blob, error } = await admin.storage.from("incoming").download(ref.path);
  if (error || !blob) throw new Error("upload not found");
  let buffer: Buffer = Buffer.from(await blob.arrayBuffer());
  await admin.storage.from("incoming").remove([ref.path]);

  const real = sniffType(buffer);
  if (real === "image/heic") throw new Error("heic");
  if (!real || !allowedTypesFor(purpose).includes(real)) throw new Error("invalid file type");
  if (buffer.length > maxBytesFor(real)) throw new Error("file too large");

  const isImage = IMAGE_TYPES.includes(real);
  let exif: ImageExif = { takenAt: null, gpsLat: null, gpsLng: null };
  let contentType = real;
  let ext = extForType(real);
  if (isImage) {
    exif = await readImageExif(buffer);
    buffer = await reencodeImage(buffer);
    contentType = "image/jpeg";
    ext = "jpg";
  }
  return {
    buffer,
    contentType,
    ext,
    originalName: String(ref.name ?? "").slice(0, 200),
    isImage,
    exif,
  };
}

export function parseUploadRefs(json: unknown): UploadedRef[] {
  if (typeof json !== "string" || !json) return [];
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) return [];
    return arr.slice(0, 10).map((r) => {
      const num = (v: unknown, min: number, max: number) =>
        typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : null;
      const lat = num(r?.lat, -90, 90);
      const lng = num(r?.lng, -180, 180);
      const capturedAt =
        typeof r?.capturedAt === "string" && !Number.isNaN(Date.parse(r.capturedAt))
          ? new Date(r.capturedAt).toISOString()
          : null;
      const clientRef =
        typeof r?.clientRef === "string" && new RegExp(`^${UUID}$`).test(r.clientRef)
          ? r.clientRef
          : null;
      return {
        path: String(r?.path ?? ""),
        name: String(r?.name ?? ""),
        type: String(r?.type ?? ""),
        source: r?.source === "camera" ? ("camera" as const) : ("upload" as const),
        capturedAt,
        lat: lat !== null && lng !== null ? lat : null,
        lng: lat !== null && lng !== null ? lng : null,
        accuracy: num(r?.accuracy, 0, 100000),
        clientRef,
      };
    });
  } catch {
    return [];
  }
}

/** Longest a capture may wait on the phone (offline) before it is refused. */
export const MAX_OFFLINE_AGE_MS = 30 * 24 * 3600 * 1000;

export interface Provenance {
  takenAt: string | null;
  gpsLat: number | null;
  gpsLng: number | null;
  accuracy: number | null;
  source: "camera" | "upload";
}

/**
 * When and where a file was captured.
 *  - In-app camera: the phone's capture time + GPS, recorded at the shutter
 *    (and kept while the file waits offline).
 *  - File upload (admin only): EXIF from the file itself.
 * Field staff must use the in-app camera (no gallery uploads).
 */
export function captureProvenance(
  ref: UploadedRef,
  exif: ImageExif,
  opts: { requireCamera: boolean; now?: number }
): Provenance {
  const now = opts.now ?? Date.now();
  if (ref.source === "camera" && ref.capturedAt) {
    const t = Date.parse(ref.capturedAt);
    if (t > now + 10 * 60 * 1000 || t < now - MAX_OFFLINE_AGE_MS) {
      throw new Error("capture time");
    }
    return {
      takenAt: ref.capturedAt,
      gpsLat: ref.lat ?? null,
      gpsLng: ref.lng ?? null,
      accuracy: ref.accuracy ?? null,
      source: "camera",
    };
  }
  if (opts.requireCamera) throw new Error("camera required");
  return {
    takenAt: exif.takenAt?.toISOString() ?? null,
    gpsLat: exif.gpsLat,
    gpsLng: exif.gpsLng,
    accuracy: null,
    source: "upload",
  };
}

/** Delete browser uploads that turned out not to be needed (replays). */
export async function discardIncoming(userId: string, refs: UploadedRef[]): Promise<void> {
  const re = new RegExp(`^${userId}/${UUID}\\.(jpg|png|webp|pdf|mp4|mov|webm)$`);
  const paths = refs.map((r) => r.path).filter((p) => re.test(p));
  if (paths.length === 0) return;
  try {
    await createAdminClient().storage.from("incoming").remove(paths);
  } catch {
    // best effort
  }
}

/** Map a takeIncoming() failure to a short error code for the UI. */
export function uploadErrorCode(
  e: unknown
): "heic" | "toobig" | "filetype" | "camera" | "capturetime" | "error" {
  const m = e instanceof Error ? e.message : "";
  if (m === "camera required") return "camera";
  if (m === "capture time") return "capturetime";
  if (m === "heic") return "heic";
  if (m === "file too large") return "toobig";
  if (m === "invalid file type") return "filetype";
  return "error";
}

/**
 * Admin: claim an uploaded supplier quote (photo/PDF) and store it in the
 * private documents bucket under quotes/<requestId>/. Returns the path.
 */
export async function storeQuoteFile(userId: string, ref: UploadedRef, requestId: string): Promise<string> {
  if (!new RegExp(`^${UUID}$`).test(requestId)) throw new Error("invalid request");
  const f = await takeIncoming(userId, ref, "quote-file");
  return storePrivate("documents", `quotes/${requestId}`, f.buffer, f.contentType, f.ext);
}
