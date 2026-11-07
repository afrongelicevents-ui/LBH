"use client";

import { useState } from "react";
import { directUpload, type UploadError } from "@/lib/directUpload";
import type { UploadPurpose, UploadedRef } from "@/lib/uploads";

export type { UploadError };

/**
 * Upload files straight from the phone/browser to private Supabase Storage.
 * Returns references the next server action uses to claim the files.
 * Large phone photos and videos never pass through the web server.
 */
export function useDirectUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  async function upload(
    purpose: UploadPurpose,
    files: File[]
  ): Promise<{ ok: true; refs: UploadedRef[] } | { ok: false; error: UploadError }> {
    const list = files.filter((f) => f && f.size > 0).slice(0, 10);
    if (list.length === 0) return { ok: true, refs: [] };
    setUploading(true);
    setProgress({ done: 0, total: list.length });
    try {
      return await directUpload(
        purpose,
        list.map((f) => ({ blob: f, name: f.name, type: f.type })),
        (done, total) => setProgress({ done, total })
      );
    } catch {
      return { ok: false, error: "error" };
    } finally {
      setUploading(false);
    }
  }

  return { upload, uploading, progress };
}
