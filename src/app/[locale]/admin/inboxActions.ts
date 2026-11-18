"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { requireAdminAction } from "@/lib/auth/admin-guard";
import { sendEmail } from "@/lib/email";
import { brandedHtml, brandedText, type BrandedEmail } from "@/lib/emailLayout";
import { site } from "@/config/site";
import { DAYS, isTime } from "@/lib/officeHours";

export type InboxResult = { ok: true } | { ok: false; error: string };

const UUID = z.string().uuid();
const KIND = z.enum(["booking", "visitor_chat", "client_chat"]);
const done = () => revalidatePath("/[locale]/admin", "layout");

/** Give an open booking or chat to a team member (or nobody). */
export async function assignInbox(kind: string, ref: string, adminId: string): Promise<InboxResult> {
  try {
    const { supabase, user } = await requireAdminAction();
    const k = KIND.safeParse(kind);
    if (!k.success || !UUID.safeParse(ref).success || (adminId && !UUID.safeParse(adminId).success)) return { ok: false, error: "invalid" };
    if (adminId) {
      const { data: p } = await supabase.from("profiles").select("role").eq("id", adminId).maybeSingle();
      if (p?.role !== "admin") return { ok: false, error: "invalid" };
    }
    const { error } = await supabase
      .from("inbox_assignments")
      .upsert({ kind: k.data, ref, assigned_to: adminId || null, updated_by: user.id, updated_at: new Date().toISOString() });
    if (error) return { ok: false, error: "db" };
    done();
    return { ok: true };
  } catch {
    return { ok: false, error: "auth" };
  }
}

/** Answer a website visitor: shown in their chat and emailed to them. */
export async function replyVisitorChat(chatId: string, _prev: InboxResult | null, fd: FormData): Promise<InboxResult> {
  try {
    const { supabase, user } = await requireAdminAction();
    if (!UUID.safeParse(chatId).success) return { ok: false, error: "invalid" };
    const body = z.string().trim().min(1).max(4000).safeParse(fd.get("body"));
    if (!body.success) return { ok: false, error: "invalid" };
    const { data: chat } = await supabase.from("visitor_chats").select("id, name, email, locale").eq("id", chatId).maybeSingle();
    if (!chat) return { ok: false, error: "invalid" };
    const { error } = await supabase.from("visitor_chat_messages").insert({ chat_id: chatId, author: "lbh", sender_id: user.id, body: body.data });
    if (error) return { ok: false, error: "db" };
    const now = new Date().toISOString();
    await supabase.from("visitor_chats").update({ waiting_since: null, last_message_at: now, status: "open" }).eq("id", chatId);
    // the first reply makes the person who answered the owner, unless someone already is
    const { data: a } = await supabase.from("inbox_assignments").select("assigned_to").eq("kind", "visitor_chat").eq("ref", chatId).maybeSingle();
    if (!a?.assigned_to) await supabase.from("inbox_assignments").upsert({ kind: "visitor_chat", ref: chatId, assigned_to: user.id, updated_by: user.id, updated_at: now });

    if (chat.email) {
      const t = await getTranslations({ locale: chat.locale, namespace: "site.chat" });
      const mail: BrandedEmail = {
        preheader: body.data.slice(0, 90),
        title: t("replyTitle"),
        paragraphs: [t("replyIntro", { name: chat.name.split(/\s+/)[0] }), body.data],
        button: { label: t("open"), href: `${site.url}${chat.locale === "en" ? "" : `/${chat.locale}`}/contact?chat=open` },
        note: t("replyNote"),
      };
      await sendEmail({ to: chat.email, subject: t("replySubject"), text: brandedText(mail), html: brandedHtml(mail) });
    }
    done();
    return { ok: true };
  } catch {
    return { ok: false, error: "auth" };
  }
}

/** Close a chat that needs nothing more (or open it again). */
export async function setVisitorChatStatus(chatId: string, status: "open" | "closed"): Promise<InboxResult> {
  try {
    const { supabase } = await requireAdminAction();
    if (!UUID.safeParse(chatId).success || !["open", "closed"].includes(status)) return { ok: false, error: "invalid" };
    const patch = status === "closed" ? { status, waiting_since: null } : { status };
    const { error } = await supabase.from("visitor_chats").update(patch).eq("id", chatId);
    if (error) return { ok: false, error: "db" };
    done();
    return { ok: true };
  } catch {
    return { ok: false, error: "auth" };
  }
}

/** The admin has looked at the Inbox: clear their new-alert badge. */
export async function markAlertsSeen(): Promise<void> {
  try {
    const { supabase } = await requireAdminAction();
    await supabase.rpc("admin_alerts_seen");
    done();
  } catch {
    /* not an admin with 2FA: nothing to clear */
  }
}

/** Reply promise, office hours and who gets alert emails. */
export async function saveReplySettings(_prev: InboxResult | null, fd: FormData): Promise<InboxResult> {
  try {
    const { supabase, user } = await requireAdminAction();
    const hours = Number(fd.get("reply_hours"));
    if (!Number.isInteger(hours) || hours < 1 || hours > 168) return { ok: false, error: "hours" };
    const office: Record<string, { open: string; close: string } | null> = {};
    for (const d of DAYS) {
      const on = fd.get(`${d}_on`) === "on";
      const open = String(fd.get(`${d}_open`) ?? "");
      const close = String(fd.get(`${d}_close`) ?? "");
      if (!on) office[d] = null;
      else if (isTime(open) && isTime(close) && open < close) office[d] = { open, close };
      else return { ok: false, error: "times" };
    }
    const emails = String(fd.get("alert_emails") ?? "")
      .split(/[\s,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    if (emails.length > 20 || emails.some((e) => !z.string().email().safeParse(e).success)) return { ok: false, error: "emails" };
    const { error } = await supabase
      .from("settings")
      .update({ reply_hours: hours, office_hours: office, alert_emails: emails, updated_by: user.id, updated_at: new Date().toISOString() })
      .eq("id", 1);
    if (error) return { ok: false, error: "db" };
    await supabase.rpc("admin_log_audit", { p_action: "settings.replies_updated", p_entity: "settings", p_entity_id: "1", p_data: { reply_hours: hours } });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch {
    return { ok: false, error: "auth" };
  }
}
