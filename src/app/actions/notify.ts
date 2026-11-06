"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimited } from "@/lib/ratelimit";

const schema = z
  .object({
    email: z.string().trim().email().max(254).optional().or(z.literal("")),
    whatsapp: z
      .string()
      .trim()
      .regex(/^\+?[0-9\s\-()]{7,20}$/)
      .optional()
      .or(z.literal("")),
    service: z.enum(["monitoring", "camera"]),
    locale: z.enum(["en", "sn", "nd"]).default("en"),
    website: z.string().max(0).optional(), // honeypot
  })
  .refine((d) => d.email || d.whatsapp, { message: "contact required" });

export type NotifyResult = "ok" | "invalid" | "rate" | "error";

/** "Notify me" for coming-soon services (brief §2). */
export async function submitNotifyInterest(
  _prev: NotifyResult | null,
  formData: FormData
): Promise<NotifyResult> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return "invalid";
  if (raw.website) return "ok"; // honeypot

  if (await rateLimited("notify", 10, 3600)) return "rate";

  const admin = createAdminClient();
  const { error } = await admin.from("notify_interest").insert({
    email: parsed.data.email || null,
    whatsapp: parsed.data.whatsapp || null,
    service: parsed.data.service,
    locale: parsed.data.locale,
  });
  if (error) {
    console.error(`[notify] ${error.message}`);
    return "error";
  }
  return "ok";
}
