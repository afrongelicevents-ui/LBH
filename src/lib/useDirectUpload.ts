"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { requestUploadSlots } from "@/app/actions/uploads";
import type { UploadPurpose, UploadedRef } from "@/lib/uploads";

export type UploadError = "auth" | "invalid" | "type" | "size" | "rate" | "error";

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
      const slots = await requestUploadSlots({
        purpose,
        files: list.map((f) => ({ type: f.type, size: f.size })),
      });
      if (!slots.ok) return { ok: false, error: slots.error };

      const supabase = createClient();
      const refs: UploadedRef[] = [];
      for (let i = 0; i < list.length; i++) {
        const { path, token } = slots.slots[i];
        const { error } = await supabase.storage
          .from("incoming")
          .uploadToSignedUrl(path, token, list[i], { contentType: list[i].type });
        if (error) return { ok: false, error: "error" };
        refs.push({ path, name: list[i].name, type: list[i].type });
        setProgress({ done: i + 1, total: list.length });
      }
      return { ok: true, refs };
    } catch {
      return { ok: false, error: "error" };
    } finally {
      setUploading(false);
    }
  }

  return { upload, uploading, progress };
}
