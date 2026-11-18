import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AlertKind } from "@/lib/inbox";

export interface InboxItem {
  kind: AlertKind;
  ref: string;
  name: string;
  contact: string;
  preview: string;
  /** waiting since (open items) or last activity (answered/closed) */
  at: string;
  href: string;
  assignedTo: string | null;
  open: boolean;
}

/**
 * Everything the team has to answer, read with the admin's own (RLS) client:
 * new bookings, website chats waiting for a reply, and customers whose last
 * support-chat message has no answer yet.
 */
export async function loadInbox(supabase: SupabaseClient): Promise<{ open: InboxItem[]; recent: InboxItem[]; admins: { id: string; name: string }[] }> {
  const [bookings, chats, messages, assigns, admins] = await Promise.all([
    supabase.from("call_bookings").select("id, name, email, whatsapp, service, description, status, created_at").order("created_at", { ascending: false }).limit(200),
    supabase.from("visitor_chats").select("id, name, email, phone, status, waiting_since, last_message_at, created_at").order("last_message_at", { ascending: false }).limit(200),
    supabase.from("messages").select("client_id, sender_id, body, created_at, profiles:client_id(full_name, email)").order("created_at", { ascending: false }).limit(800),
    supabase.from("inbox_assignments").select("kind, ref, assigned_to"),
    supabase.from("profiles").select("id, full_name, email").eq("role", "admin").order("full_name"),
  ]);
  const assigned = new Map((assigns.data ?? []).map((a) => [`${a.kind}:${a.ref}`, a.assigned_to as string | null]));
  const who = (kind: AlertKind, ref: string) => assigned.get(`${kind}:${ref}`) ?? null;
  const items: InboxItem[] = [];

  for (const b of bookings.data ?? []) {
    items.push({
      kind: "booking",
      ref: b.id,
      name: b.name,
      contact: [b.email, b.whatsapp].filter(Boolean).join(" · "),
      preview: [b.service, b.description].filter(Boolean).join(" — ").slice(0, 160),
      at: b.created_at,
      href: "/admin/bookings",
      assignedTo: who("booking", b.id),
      open: b.status === "new",
    });
  }

  const lastPreview = new Map<string, string>();
  for (const c of chats.data ?? []) {
    items.push({
      kind: "visitor_chat",
      ref: c.id,
      name: c.name,
      contact: [c.email, c.phone].filter(Boolean).join(" · "),
      preview: lastPreview.get(c.id) ?? "",
      at: c.status === "open" && c.waiting_since ? c.waiting_since : c.last_message_at,
      href: `/admin/inbox/chat/${c.id}`,
      assignedTo: who("visitor_chat", c.id),
      open: c.status === "open" && Boolean(c.waiting_since),
    });
  }
  // latest visitor message as the preview
  const chatIds = (chats.data ?? []).map((c) => c.id);
  if (chatIds.length) {
    const { data: last } = await supabase
      .from("visitor_chat_messages")
      .select("chat_id, body, created_at")
      .in("chat_id", chatIds.slice(0, 100))
      .eq("author", "visitor")
      .order("created_at", { ascending: false })
      .limit(400);
    for (const m of last ?? []) if (!lastPreview.has(m.chat_id)) lastPreview.set(m.chat_id, m.body.slice(0, 160));
    for (const it of items) if (it.kind === "visitor_chat") it.preview = lastPreview.get(it.ref) ?? "";
  }

  // customer support chats: waiting = client messages after the last LBH reply
  const byClient = new Map<string, NonNullable<typeof messages.data>>();
  for (const m of messages.data ?? []) byClient.set(m.client_id, [...(byClient.get(m.client_id) ?? []), m]);
  for (const [clientId, list] of byClient) {
    // list is newest first
    const unanswered = [];
    for (const m of list) {
      if (m.sender_id !== clientId) break;
      unanswered.push(m);
    }
    const p = list[0].profiles as unknown as { full_name: string; email: string } | null;
    const waiting = unanswered.length > 0;
    items.push({
      kind: "client_chat",
      ref: clientId,
      name: p?.full_name || p?.email || "Customer",
      contact: p?.email ?? "",
      preview: list[0].body.slice(0, 160),
      at: waiting ? unanswered[unanswered.length - 1].created_at : list[0].created_at,
      href: `/admin/chats/${clientId}`,
      assignedTo: who("client_chat", clientId),
      open: waiting,
    });
  }

  const open = items.filter((i) => i.open).sort((a, b) => a.at.localeCompare(b.at)); // longest waiting first
  const recent = items.filter((i) => !i.open).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 15);
  return { open, recent, admins: (admins.data ?? []).map((a) => ({ id: a.id, name: a.full_name || a.email })) };
}
