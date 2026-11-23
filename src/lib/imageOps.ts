import "server-only";

/**
 * Image re-encoding that works on both hosts:
 *  - Cloudflare Workers: the Images binding (env.IMAGES) — native code can't run there.
 *  - Node (local dev, tests, Vercel): sharp.
 * Output is always a JPEG with metadata stripped and EXIF orientation applied.
 */

export interface JpegResult {
  data: Buffer;
  width: number;
  height: number;
}

export interface JpegOptions {
  /** Longest side in px; never enlarges. Omit to keep the original size. */
  maxSize?: number;
  quality?: number;
}

interface ImagesBinding {
  input(stream: ReadableStream<Uint8Array>): {
    transform(t: Record<string, unknown>): {
      output(o: { format: string; quality?: number }): Promise<{ response(): Response }>;
    };
    output(o: { format: string; quality?: number }): Promise<{ response(): Response }>;
  };
}

async function imagesBinding(): Promise<ImagesBinding | null> {
  const ctx = (globalThis as Record<symbol, unknown>)[Symbol.for("__cloudflare-context__")] as
    | { env?: { IMAGES?: ImagesBinding } }
    | undefined;
  return ctx?.env?.IMAGES ?? null;
}

function streamOf(buf: Buffer): ReadableStream<Uint8Array> {
  return new Blob([new Uint8Array(buf)]).stream();
}

/** Width/height from a JPEG's SOF marker. */
export function jpegSize(buf: Buffer): { width: number; height: number } {
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = buf[i + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    const len = buf.readUInt16BE(i + 2);
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  return { width: 0, height: 0 };
}

export async function toJpeg(input: Buffer, opts: JpegOptions = {}): Promise<JpegResult> {
  const quality = opts.quality ?? 85;
  const images = await imagesBinding();
  if (images) {
    const img = images.input(streamOf(input));
    const result = opts.maxSize
      ? await img
          .transform({ width: opts.maxSize, height: opts.maxSize, fit: "scale-down", metadata: "none" })
          .output({ format: "image/jpeg", quality })
      : await img.transform({ metadata: "none" }).output({ format: "image/jpeg", quality });
    const data = Buffer.from(await result.response().arrayBuffer());
    return { data, ...jpegSize(data) };
  }

  const sharp = (await import("sharp")).default;
  let pipeline = sharp(input, { failOn: "error" }).rotate();
  if (opts.maxSize) {
    pipeline = pipeline.resize({ width: opts.maxSize, height: opts.maxSize, fit: "inside", withoutEnlargement: true });
  }
  const { data, info } = await pipeline
    .jpeg({ quality, mozjpeg: true, progressive: true })
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}
