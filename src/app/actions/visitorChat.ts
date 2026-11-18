"use server";

import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimited } from "@/lib/ratelimit";
import { sendEmail } from "@/lib/email";
import { brandedHtml, brandedText, type BrandedEmail } from "@/lib/emailLayout";
import { alertTeam, getReplySettings, newChatToken, officeStatus, tokenMatches } from "@/lib/inbox";
import { routing } from "@/i18n/routing";

export type ChatMessage = { id: string; author: "visitor" | "lbh" | "auto"; body: string; at: string };
export type StartResult = { ok: true; chatId: string; token: string; messages: ChatMessage[] } | { ok: false; error: string };
export type ThreadResult = { ok: true; messages: ChatMessage[]; closed: boolean } | { ok: false; error: string };

const UUID = z.string().uuid();
const body = z.string().trim().min(1).max(4000);
const startSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    email: z.union([z.literal(""), z.string().trim().toLowerCase().email().max(254)]).default(""),
    phone: z
      .string()
      .trim()
      .max(40)
      .default("")
      .refine((v) => v === "" || /^\+?[0-9 ()-]{6,40}$/.test(v)),
    message: body,
    page: z.string().max(300).default(""),
    locale: z.enum(routing.locales as unknown as [string, ...string[]]).default("en"),
  })
  .refine((d) => d.email !== "" || d.phone !== "", { path: ["email"] });

async function readThread(chatId: string): Promise<ChatMessage[]> {
  const { data } = await createAdminClient()
    .from("visitor_chat_messages")
    .select("id, author, body, created_at")
    .eq("chat_id", chatId)
    .order("created_at")
    .limit(300);
  return (data ?? []).map((m) => ({ id: m.id, author: m.author, body: m.body, at: m.created_at }));
}

/** First message from a visitor (no account): opens a thread, confirms instantly, alerts the team. */
export async function startVisitorChat(_prev: StartResult | null, fd: FormData): Promise<StartResult> {
  try {
    if (String(fd.get("website") ?? "") !== "") return { ok: false, error: "invalid" }; // honeypot
    const p = startSchema.safeParse(Object.fromEntries(fd.entries()));
    if (!p.success) return { ok: false, error: p.error.issues[0]?.path?.[0] === "email" && !String(fd.get("email") ?? "") && !String(fd.get("phone") ?? "") ? "contact" : "invalid" };
    if (await rateLimited("visitor-chat-start", 5, 3600)) return { ok: false, error: "rate" };
    const d = p.data;
    const admin = createAdminClient();
    const { token, hash } = newChatToken();
    const now = new Date().toISOString();
    const { data: chat, error } = await admin
      .from("visitor_chats")
      .insert({ token_hash: hash, name: d.name, email: d.email, phone: d.phone, locale: d.locale, page: d.page.startsWith("/") ? d.page : "", waiting_since: now, last_message_at: now })
      .select("id")
      .single();
    if (error || !chat) return { ok: false, error: "error" };

    const t = await getTranslations({ locale: d.locale, namespace: "site.chat" });
    const { replyHours } = await getReplySettings();
    const firstName = d.name.split(/\s+/)[0];
    await admin.from("visitor_chat_messages").insert([
      { chat_id: chat.id, author: "visitor", body: d.message },
      { chat_id: chat.id, author: "auto", body: t("autoReply", { name: firstName, hours: replyHours }) },
    ]);

    if (d.email) {
      const mail: BrandedEmail = {
        preheader: t("emailThanksPre", { hours: replyHours }),
        title: t("emailThanksTitle"),
        paragraphs: [t("emailHi", { name: firstName }), t("emailThanks", { hours: replyHours }), `“${d.message.slice(0, 600)}”`],
        note: t("emailNote"),
      };
      await sendEmail({ to: d.email, subject: t("emailThanksSubject"), text: brandedText(mail), html: brandedHtml(mail) });
    }
    await alertTeam({
      kind: "visitor_chat",
      ref: chat.id,
      inApp: true,
      title: `New chat from ${d.name}`,
      lines: [`${d.name} · ${[d.email, d.phone].filter(Boolean).join(" · ")}`, `“${d.message.slice(0, 600)}”`, d.page ? `Page: ${d.page}` : ""].filter(Boolean),
      path: `/admin/inbox/chat/${chat.id}`,
    });
    return { ok: true, chatId: chat.id, token, messages: await readThread(chat.id) };
  } catch (e) {
    console.error(`[visitor-chat] ${e instanceof Error ? e.message : e}`);
    return { ok: false, error: "error" };
  }
}

async function ownChat(chatId: string, token: string) {
  if (!UUID.safeParse(chatId).success) return null;
  const { data } = await createAdminClient().from("visitor_chats").select("id, token_hash, status, name, waiting_since").eq("id", chatId).maybeSingle();
  return data && tokenMatches(token, data.token_hash) ? data : null;
}

/** The visitor's own thread (polled while the chat is open). */
export async function loadVisitorChat(chatId: string, token: string): Promise<ThreadResult> {
  try {
    const chat = await ownChat(chatId, token);
    if (!chat) return { ok: false, error: "gone" };
    return { ok: true, messages: await readThread(chat.id), closed: chat.status === "closed" };
  } catch {
    return { ok: false, error: "error" };
  }
}

/** A follow-up message from the visitor. */
export async function sendVisitorMessage(chatId: string, token: string, text: string): Promise<ThreadResult> {
  try {
    const chat = await ownChat(chatId, token);
    if (!chat) return { ok: false, error: "gone" };
    const b = body.safeParse(text);
    if (!b.success) return { ok: false, error: "invalid" };
    if (await rateLimited("visitor-chat-msg", 40, 3600)) return { ok: false, error: "rate" };
    const admin = createAdminClient();
    const now = new Date().toISOString();
    await admin.from("visitor_chat_messages").insert({ chat_id: chat.id, author: "visitor", body: b.data });
    const wasWaiting = Boolean(chat.waiting_since);
    await admin
      .from("visitor_chats")
      .update({ status: "open", last_message_at: now, ...(wasWaiting ? {} : { waiting_since: now }) })
      .eq("id", chat.id);
    // one alert per unanswered stretch, not one per message
    if (!wasWaiting) {
      await alertTeam({
        kind: "visitor_chat",
        ref: chat.id,
        inApp: true,
        title: `New message from ${chat.name}`,
        lines: [`“${b.data.slice(0, 600)}”`],
        path: `/admin/inbox/chat/${chat.id}`,
      });
    }
    return { ok: true, messages: await readThread(chat.id), closed: false };
  } catch {
    return { ok: false, error: "error" };
  }
}

/** Online now / reply within N hours, and whether WhatsApp is available. */
export async function getOfficeStatus() {
  return officeStatus();
}
