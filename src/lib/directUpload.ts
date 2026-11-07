"use client";

import { createClient } from "@/lib/supabase/client";
import { requestUploadSlots } from "@/app/actions/uploads";
import type { UploadPurpose, UploadedRef } from "@/lib/uploads";

export type UploadError = "auth" | "invalid" | "type" | "size" | "rate" | "error";

/** Base MIME type without codec parameters ("video/webm;codecs=vp8" → "video/webm"). */
export function baseType(type: string): string {
  return type.split(";")[0].trim().toLowerCase();
}

export interface UploadItem {
  blob: Blob;
  name: string;
  type?: string;
  /** extra fields carried on the reference (capture time, GPS, client id) */
  meta?: Omit<UploadedRef, "path" | "name" | "type">;
}

/**
 * Upload files straight from the phone/browser to private Supabase Storage.
 * Returns references the next server action uses to claim the files.
 * Throws on network failure (so offline callers can retry later).
 */
export async function directUpload(
  purpose: UploadPurpose,
  items: UploadItem[],
  onProgress?: (done: number, total: number) => void
): Promise<{ ok: true; refs: UploadedRef[] } | { ok: false; error: UploadError }> {
  const list = items.filter((f) => f.blob && f.blob.size > 0).slice(0, 10);
  if (list.length === 0) return { ok: true, refs: [] };
  const types = list.map((f) => baseType(f.type || f.blob.type));

  const slots = await requestUploadSlots({
    purpose,
    files: list.map((f, i) => ({ type: types[i], size: f.blob.size })),
  });
  if (!slots.ok) return { ok: false, error: slots.error };

  const supabase = createClient();
  const refs: UploadedRef[] = [];
  for (let i = 0; i < list.length; i++) {
    const { path, token } = slots.slots[i];
    const { error } = await supabase.storage
      .from("incoming")
      .uploadToSignedUrl(path, token, list[i].blob, { contentType: types[i] });
    if (error) throw new Error(`upload failed: ${error.message}`);
    refs.push({ path, name: list[i].name, type: types[i], ...(list[i].meta ?? {}) });
    onProgress?.(i + 1, list.length);
  }
  return { ok: true, refs };
}
