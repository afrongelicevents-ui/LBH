"use server";

import { z } from "zod";
import { getUserProfile } from "@/lib/supabase/server";
import { rateLimited } from "@/lib/ratelimit";
import {
  allowedTypesFor,
  createUploadSlot,
  maxBytesFor,
  type UploadPurpose,
} from "@/lib/uploads";

const schema = z.object({
  purpose: z.enum(["client-document", "staff-media", "quote-file", "site-photo", "ba-receipt"]),
  files: z
    .array(
      z.object({
        type: z.string().max(100),
        size: z.number().int().positive(),
      })
    )
    .min(1)
    .max(10),
});

export type SlotResult =
  | { ok: true; slots: { path: string; token: string }[] }
  | { ok: false; error: "auth" | "invalid" | "type" | "size" | "rate" | "error" };

/**
 * Hand out signed one-time upload slots so the browser can send files
 * straight to private storage. Nothing is attached to any record here —
 * the follow-up server action claims the file with takeIncoming(), which
 * re-checks ownership, real type and size.
 */
export async function requestUploadSlots(input: {
  purpose: UploadPurpose;
  files: { type: string; size: number }[];
}): Promise<SlotResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { purpose, files } = parsed.data;

  const { user, profile, aal } = await getUserProfile();
  if (!user || !profile) return { ok: false, error: "auth" };
  const isStaff = profile.role === "admin" || profile.role === "field";
  if ((purpose === "client-document" || purpose === "ba-receipt") && profile.role !== "client") {
    return { ok: false, error: "auth" };
  }
  if (purpose === "staff-media" && (!isStaff || aal !== "aal2")) {
    return { ok: false, error: "auth" };
  }
  if ((purpose === "quote-file" || purpose === "site-photo") && (profile.role !== "admin" || aal !== "aal2")) {
    return { ok: false, error: "auth" };
  }

  const allowed = allowedTypesFor(purpose);
  for (const f of files) {
    if (!allowed.includes(f.type)) return { ok: false, error: "type" };
    if (f.size > maxBytesFor(f.type)) return { ok: false, error: "size" };
  }

  if (await rateLimited(`upload-slot:${user.id}`, 120, 3600)) {
    return { ok: false, error: "rate" };
  }

  try {
    const slots = [];
    for (const f of files) slots.push(await createUploadSlot(user.id, f.type));
    return { ok: true, slots };
  } catch (e) {
    console.error(`[upload-slot] ${e instanceof Error ? e.message : e}`);
    return { ok: false, error: "error" };
  }
}
