import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { site } from "@/config/site";
import { inviteLink } from "@/lib/emailLayout";

/**
 * Find the client account for a public form's email, or create one (unconfirmed)
 * and return a branded invite link for the confirmation email. Staff accounts are
 * never attached to public bookings. Uses the verified auth email, never the
 * user-editable profile row.
 */
export async function findOrCreateClient(
  admin: SupabaseClient,
  d: { email: string; name: string; whatsapp: string; country: string }
): Promise<{ clientId: string | null; invite: string | null; created: boolean }> {
  const { data: existingId } = await admin.rpc("find_user_id_by_email", { p_email: d.email });
  if (existingId) {
    const { data: p } = await admin.from("profiles").select("role").eq("id", existingId).single();
    return { clientId: p?.role === "client" ? (existingId as string) : null, invite: null, created: false };
  }
  const { data: created, error } = await admin.auth.admin.createUser({
    email: d.email.toLowerCase(),
    email_confirm: false,
    user_metadata: { full_name: d.name, whatsapp: d.whatsapp, country: d.country },
  });
  if (error) {
    console.error(`[client-account] createUser: ${error.message}`);
    return { clientId: null, invite: null, created: false };
  }
  const { data: link } = await admin.auth.admin.generateLink({
    type: "invite",
    email: d.email.toLowerCase(),
    options: { redirectTo: `${site.url}/account/password` },
  });
  return { clientId: created.user.id, invite: inviteLink(link?.properties?.hashed_token), created: true };
}
