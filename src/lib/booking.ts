import { z } from "zod";
import { countryFields, refineCountry } from "@/lib/country";

/** Booking request schema (brief §5.1). All input is validated server-side. */
export const bookingSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  whatsapp: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s\-()]{7,20}$/, "invalid phone"),
  ...countryFields,
  service: z.enum(["land", "materials", "monitoring", "camera", "not-sure"]),
  description: z.string().trim().max(2000).optional().default(""),
  slot: z.enum(["morning", "afternoon", "evening", "weekend"]),
  callType: z.enum(["phone", "video"]),
  // Honeypot — must stay empty (simple bot deterrent until Turnstile lands in Phase 7)
  website: z.string().max(0).optional(),
}).superRefine(refineCountry);

export type BookingInput = z.infer<typeof bookingSchema>;
