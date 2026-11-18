"use server";

import { getUserProfile } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { alertTeam } from "@/lib/inbox";

/**
 * After a customer writes in their support chat: email the team, but only
 * for the message that opened a new alert (the database trigger raises one
 * alert per waiting customer per 30 minutes), so a burst of messages sends
 * one email.
 */
export async function notifyClientMessage(): Promise<void> {
  try {
    const { user, profile } = await getUserProfile();
    if (!user || profile?.role !== "client") return;
    const { data: alert } = await createAdminClient()
      .from("admin_alerts")
      .select("id, created_at")
      .eq("kind", "client_chat")
      .eq("ref", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!alert || Date.now() - new Date(alert.created_at).getTime() > 60_000) return;
    const { data: last } = await createAdminClient()
      .from("messages")
      .select("body")
      .eq("client_id", user.id)
      .eq("sender_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    await alertTeam({
      kind: "client_chat",
      ref: user.id,
      title: `New message from ${profile.full_name || profile.email}`,
      lines: [`Customer: ${profile.full_name || ""} · ${profile.email}`, last ? `“${String(last.body).slice(0, 600)}”` : ""].filter(Boolean),
      path: `/admin/chats/${user.id}`,
    });
  } catch (e) {
    console.error(`[client-chat alert] ${e instanceof Error ? e.message : e}`);
  }
}
