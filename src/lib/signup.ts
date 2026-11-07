import { z } from "zod";

/** Client self sign-up (staff and admin accounts stay invite-only). */
export const signupSchema = z
  .object({
    full_name: z.string().trim().min(2).max(120),
    email: z.string().trim().toLowerCase().email().max(254),
    whatsapp: z
      .string()
      .trim()
      .regex(/^\+?[0-9\s\-()]{7,20}$/, "invalid phone"),
    country: z.enum(["uk", "usa", "sa", "other"]),
    password: z.string().min(10).max(72),
    confirm_password: z.string(),
    terms: z.literal("on"),
    locale: z.enum(["en", "sn", "nd"]).default("en"),
    website: z.string().max(0).optional(), // honeypot
  })
  .refine((d) => d.password === d.confirm_password, {
    path: ["confirm_password"],
    message: "mismatch",
  });

export type SignupInput = z.infer<typeof signupSchema>;

/** Only same-site relative paths are allowed as a post-confirmation target. */
export function safeNextPath(next: string | null | undefined, fallback = "/portal"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return fallback;
  }
  return next;
}
