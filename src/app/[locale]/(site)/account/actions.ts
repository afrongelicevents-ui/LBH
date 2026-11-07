"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getUserProfile } from "@/lib/supabase/server";
import { requiresMfa } from "@/lib/auth/roles";

export type ProfileResult = { ok: true } | { ok: false; error: "invalid" | "auth" | "db" };

const schema = z.object({
  full_name: z.string().trim().min(2).max(120),
  whatsapp: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s\-()]{7,20}$/)
    .or(z.literal("")),
  country: z.enum(["uk", "usa", "sa", "zw", "other", ""]),
});

/** Signed-in user edits their own name, WhatsApp and country (nothing else). */
export async function updateMyProfile(_prev: ProfileResult | null, formData: FormData): Promise<ProfileResult> {
  const { supabase, user, profile, aal } = await getUserProfile();
  if (!user || !profile) return { ok: false, error: "auth" };
  if (requiresMfa(profile.role) && aal !== "aal2") return { ok: false, error: "auth" };
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.full_name,
      whatsapp: parsed.data.whatsapp || null,
      country: parsed.data.country || null,
    })
    .eq("id", user.id);
  if (error) return { ok: false, error: "db" };
  revalidatePath("/[locale]", "layout");
  return { ok: true };
}
