"use server";

import { bookingSchema } from "@/lib/booking";
import { resolveCountry } from "@/lib/country";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimited } from "@/lib/ratelimit";
import { brandedHtml, brandedText, inviteLink, type BrandedEmail } from "@/lib/emailLayout";
import { sendEmail } from "@/lib/email";
import { site } from "@/config/site";

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
    // Existing account? Matched on the verified auth email (auth.users),
    // never on the user-editable profile row.
    const { data: existingId } = await admin.rpc("find_user_id_by_email", {
      p_email: d.email,
    });

    let clientId: string | null = null;
    let invite: string | null = null;

    if (existingId) {
      const { data: existingProfile } = await admin
        .from("profiles")
        .select("role")
        .eq("id", existingId)
        .single();
      // Only attach bookings to client accounts, never to staff.
      if (existingProfile?.role === "client") clientId = existingId as string;
    } else {
      const { data: created, error: createErr } =
        await admin.auth.admin.createUser({
          email: d.email.toLowerCase(),
          email_confirm: false,
          user_metadata: {
            full_name: d.name,
            whatsapp: d.whatsapp,
            country: resolveCountry(d) ?? "other",
          },
        });
      if (createErr) {
        console.error(`[booking] createUser: ${createErr.message}`);
      } else {
        clientId = created.user.id;
        const { data: link } = await admin.auth.admin.generateLink({
          type: "invite",
          email: d.email.toLowerCase(),
          options: {
            redirectTo: `${site.url}/account/password`,
          },
        });
        invite = inviteLink(link?.properties?.hashed_token);
      }
    }

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

    const mail: BrandedEmail = {
      preheader: "We received your request — we'll confirm the time soon.",
      title: "Your free first call is booked",
      paragraphs: [
        `Hi ${d.name},`,
        `Thank you — we received your request for a free first call (${d.slot}, ${d.callType}). We will confirm the exact time by email${site.whatsappNumber ? " and WhatsApp" : ""}.`,
        ...(invite ? ["Your LBH account is ready too: see quotes, approve costs and read reports in one place."] : []),
        "Talk soon — the Let's Build Home team.",
      ],
      ...(invite ? { button: { label: "Set up my account", href: invite } } : {}),
      note: "The call is free, with no obligation.",
    };
    await sendEmail({
      to: d.email,
      subject: "Your free first call is booked — Let's Build Home",
      text: brandedText(mail),
      html: brandedHtml(mail),
    });

    return { status: "ok" };
  } catch (e) {
    console.error(`[booking] ${e instanceof Error ? e.message : e}`);
    return { status: "error" };
  }
}
