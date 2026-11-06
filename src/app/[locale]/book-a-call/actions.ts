"use server";

import { bookingSchema } from "@/lib/booking";

export type BookingResult =
  | { status: "ok" }
  | { status: "invalid"; field?: string }
  | { status: "error" };

/**
 * Handle a "book a free first call" request.
 *
 * Phase 2 scope: validates server-side and acknowledges. Persistence to the
 * database (creating the enquiry + client account by email, admin "Needs you"
 * queue, confirmation email + WhatsApp link) is wired up in Phase 3 together
 * with Supabase — see the build plan in the README.
 */
export async function submitBooking(
  _prev: BookingResult | null,
  formData: FormData
): Promise<BookingResult> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = bookingSchema.safeParse(raw);

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { status: "invalid", field: first?.path?.[0]?.toString() };
  }

  // Honeypot filled in → pretend success, store nothing.
  if (raw.website) {
    return { status: "ok" };
  }

  try {
    // TODO(Phase 3): persist enquiry, create client account by email,
    // notify admin, send confirmation email + WhatsApp link.
    console.info(
      `[booking] request received: service=${parsed.data.service} country=${parsed.data.country} slot=${parsed.data.slot}`
    );
    return { status: "ok" };
  } catch {
    return { status: "error" };
  }
}
