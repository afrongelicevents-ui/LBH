"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getUserProfile } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimited } from "@/lib/ratelimit";
import { sendEmail } from "@/lib/email";
import { site } from "@/config/site";
import { countryFields, refineCountry, resolveCountry } from "@/lib/country";
import { findOrCreateClient } from "@/lib/clientAccount";
import { parseUploadRefs, storePrivate, takeIncoming } from "@/lib/uploads";
import { BUDGETS, ROOMS, TIMELINES } from "@/lib/interiors";

export type InteriorsResult = { ok: true; id?: string; signedIn: boolean; warning?: string } | { ok: false; error: string; field?: string };


const projectSchema = z.object({
  location: z.string().trim().min(2).max(160),
  house_status: z.enum(["finished", "nearly_finished"]),
  budget: z.enum(BUDGETS),
  timeline: z.enum(TIMELINES),
  styles: z.string().trim().max(2000).default(""),
  slot: z.enum(["morning", "afternoon", "evening", "weekend"]),
  callType: z.enum(["phone", "video"]),
});
const contactSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(254),
    whatsapp: z.string().trim().regex(/^\+?[0-9\s\-()]{7,20}$/),
    ...countryFields,
  })
  .superRefine(refineCountry);

function details(d: z.infer<typeof projectSchema>, rooms: string[]) {
  return { location: d.location, house_status: d.house_status, rooms, budget: d.budget, timeline: d.timeline, styles: d.styles, slot: d.slot, call_type: d.callType };
}

/**
 * "Book a design consultation" (Interiors & Furnishing).
 * Signed-in customers: an interiors project is created in their account, with
 * their photos/plans attached. Visitors: a booking + account invite (like the
 * free first call); they can add photos in their account afterwards.
 */
export async function submitInteriors(_prev: InteriorsResult | null, fd: FormData): Promise<InteriorsResult> {
  const raw = Object.fromEntries(fd.entries());
  if (raw.website) return { ok: true, signedIn: false }; // honeypot
  const rooms = fd.getAll("rooms").map(String).filter((r): r is (typeof ROOMS)[number] => (ROOMS as readonly string[]).includes(r));
  const parsed = projectSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid", field: parsed.error.issues[0]?.path?.[0]?.toString() };
  if (rooms.length === 0) return { ok: false, error: "invalid", field: "rooms" };
  const d = parsed.data;

  try {
    const { supabase, user, profile } = await getUserProfile();

    // ---------- signed-in customer: project straight into their account ----------
    if (user && profile?.role === "client") {
      if (await rateLimited(`interiors:${user.id}`, 10, 3600)) return { ok: false, error: "rate" };
      const { data: req, error } = await supabase
        .from("service_requests")
        .insert({ client_id: user.id, type: "interiors", status: "new", title: `Interiors — ${d.location}`, details: details(d, rooms) })
        .select("id")
        .single();
      if (error || !req) return { ok: false, error: "db" };
      let warning: string | undefined;
      try {
        for (const ref of parseUploadRefs(fd.get("uploads_json")).slice(0, 10)) {
          const f = await takeIncoming(user.id, ref, "client-document");
          const path = await storePrivate("documents", `requests/${req.id}`, f.buffer, f.contentType, f.ext);
          const { error: dErr } = await supabase.from("documents").insert({
            request_id: req.id, uploader_id: user.id, storage_path: path, file_name: f.originalName || `photo.${f.ext}`, kind: "client_document",
          });
          if (dErr) throw new Error(dErr.message);
        }
      } catch (e) {
        console.error(`[interiors docs] ${e instanceof Error ? e.message : e}`);
        warning = "docs";
      }
      revalidatePath("/[locale]/account", "layout");
      return { ok: true, id: req.id, signedIn: true, warning };
    }
    if (user) return { ok: false, error: "staff" }; // staff don't book for themselves

    // ---------- visitor: booking + account invite ----------
    const c = contactSchema.safeParse(raw);
    if (!c.success) return { ok: false, error: "invalid", field: c.error.issues[0]?.path?.[0]?.toString() };
    if (await rateLimited("interiors-booking", 5, 3600)) return { ok: false, error: "rate" };
    const admin = createAdminClient();
    const country = resolveCountry(c.data) ?? "other";
    const { clientId, inviteNote, created } = await findOrCreateClient(admin, { email: c.data.email, name: c.data.name, whatsapp: c.data.whatsapp, country });
    const summary = `Interiors: ${d.location} · ${d.house_status} · rooms: ${rooms.join(", ")} · budget ${d.budget} · ${d.timeline}${d.styles ? ` · likes: ${d.styles}` : ""}`;
    const { error: bErr } = await admin.from("call_bookings").insert({
      client_id: clientId, name: c.data.name, email: c.data.email.toLowerCase(), whatsapp: c.data.whatsapp, country,
      service: "interiors", description: summary.slice(0, 2000), preferred_slot: d.slot, call_type: d.callType, status: "new",
    });
    if (bErr) throw new Error(bErr.message);
    // Only a brand-new account gets the project straight away: someone typing another
    // person's email must not add projects to that person's account. Existing customers
    // are linked through the booking and LBH opens the project after the call.
    if (clientId && created) {
      await admin.from("service_requests").insert({ client_id: clientId, type: "interiors", status: "new", title: `Interiors — ${d.location}`, details: details(d, rooms) });
    }
    await sendEmail({
      to: c.data.email,
      subject: "LBH — your interiors design consultation is booked",
      text:
        `Hi ${c.data.name},\n\nThank you — we received your request for an interiors design consultation (${d.slot}, ${d.callType}). ` +
        `We will confirm the exact time by email and WhatsApp.\n\n` +
        (created ? `You can add photos or plans of your house in your LBH account.\n\n` : `Already have an LBH account? Log in to book with photos and plans: ${site.url}/services/interiors#book\n\n`) +
        `LBH — Let's Build Home\nWhatsApp: https://wa.me/${site.whatsappNumber}` + inviteNote,
    });
    return { ok: true, signedIn: false };
  } catch (e) {
    console.error(`[interiors] ${e instanceof Error ? e.message : e}`);
    return { ok: false, error: "error" };
  }
}
