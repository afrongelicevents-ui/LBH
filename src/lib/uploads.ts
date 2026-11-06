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

export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_DOC_BYTES = 20 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 120 * 1024 * 1024;

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
