"use server";

import { bookingSchema } from "@/lib/booking";
import { resolveCountry } from "@/lib/country";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimited } from "@/lib/ratelimit";
import { sendEmail } from "@/lib/email";
import { site } from "@/config/site";
import { findOrCreateClient } from "@/lib/clientAccount";

export type BookingResult =
  | { status: "ok" }
  | { status: "invalid"; field?: string }
  | { status: "rate" }
  | { status: "error" };

/**
 * "Book a free first call" (brief §5.1): no account needed — one is created
 * from the email. Stores the enquiry for the admin "Needs you" queue and
 * sends a confirmation email (invite link for new accounts).
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
  if (raw.website) return { status: "ok" };

  if (await rateLimited("booking", 5, 3600)) return { status: "rate" };

  const d = parsed.data;
  const admin = createAdminClient();

  try {
    const { clientId, inviteNote } = await findOrCreateClient(admin, {
      email: d.email,
      name: d.name,
      whatsapp: d.whatsapp,
      country: resolveCountry(d) ?? "other",
    });

    const { error: insertErr } = await admin.from("call_bookings").insert({
      client_id: clientId,
      name: d.name,
      email: d.email.toLowerCase(),
      whatsapp: d.whatsapp,
      country: resolveCountry(d) ?? "other",
      service: d.service,
      description: d.description ?? "",
      preferred_slot: d.slot,
      call_type: d.callType,
      status: "new",
    });
    if (insertErr) throw new Error(insertErr.message);

    await sendEmail({
      to: d.email,
      subject: "LBH — your free first call is booked",
      text:
        `Hi ${d.name},\n\n` +
        `Thank you — we received your request for a free first call ` +
        `(${d.slot}, ${d.callType}). We will confirm the exact time by email ` +
        `and WhatsApp.\n\nTalk soon,\nLBH — Let's Build Home\n` +
        `WhatsApp: https://wa.me/${site.whatsappNumber}` +
        inviteNote,
    });

    return { status: "ok" };
  } catch (e) {
    console.error(`[booking] ${e instanceof Error ? e.message : e}`);
    return { status: "error" };
  }
}
