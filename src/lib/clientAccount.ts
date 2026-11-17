import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { site } from "@/config/site";

/**
 * Find the client account for a public form's email, or create one (unconfirmed)
 * and return an invite link note for the confirmation email. Staff accounts are
 * never attached to public bookings. Uses the verified auth email, never the
 * user-editable profile row.
 */
export async function findOrCreateClient(
  admin: SupabaseClient,
  d: { email: string; name: string; whatsapp: string; country: string }
): Promise<{ clientId: string | null; inviteNote: string }> {
  const { data: existingId } = await admin.rpc("find_user_id_by_email", { p_email: d.email });
  if (existingId) {
    const { data: p } = await admin.from("profiles").select("role").eq("id", existingId).single();
    return { clientId: p?.role === "client" ? (existingId as string) : null, inviteNote: "" };
  }
  const { data: created, error } = await admin.auth.admin.createUser({
    email: d.email.toLowerCase(),
    email_confirm: false,
    user_metadata: { full_name: d.name, whatsapp: d.whatsapp, country: d.country },
  });
  if (error) {
    console.error(`[client-account] createUser: ${error.message}`);
    return { clientId: null, inviteNote: "" };
  }
  const { data: link } = await admin.auth.admin.generateLink({
    type: "invite",
    email: d.email.toLowerCase(),
    options: { redirectTo: `${site.url}/account/password` },
  });
  const inviteNote = link?.properties?.action_link
    ? `\n\nSet up your LBH account (view quotes, choose items, follow your project):\n${link.properties.action_link}`
    : "";
  return { clientId: created.user.id, inviteNote };
}
