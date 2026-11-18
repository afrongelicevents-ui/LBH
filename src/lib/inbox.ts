import "server-only";
import { cache } from "react";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { brandedHtml, brandedText, type BrandedEmail } from "@/lib/emailLayout";
import { site } from "@/config/site";
import { cleanOfficeHours, isOpenNow, type OfficeHours } from "@/lib/officeHours";

export interface ReplySettings {
  replyHours: number;
  officeHours: OfficeHours;
  officeTz: string;
  alertEmails: string[];
}

/** Reply promise, office hours and alert addresses (one read per request). */
export const getReplySettings = cache(async (): Promise<ReplySettings> => {
  const { data } = await createAdminClient()
    .from("settings")
    .select("reply_hours, office_hours, office_tz, alert_emails")
    .eq("id", 1)
    .maybeSingle();
  return {
    replyHours: data?.reply_hours ?? 24,
    officeHours: cleanOfficeHours(data?.office_hours),
    officeTz: data?.office_tz ?? "Africa/Harare",
    alertEmails: (data?.alert_emails as string[] | null) ?? [],
  };
});

export async function officeStatus(): Promise<{ online: boolean; replyHours: number; whatsapp: boolean }> {
  const s = await getReplySettings();
  return { online: isOpenNow(s.officeHours, s.officeTz), replyHours: s.replyHours, whatsapp: Boolean(site.whatsappNumber) };
}

// ---------- visitor chat tokens (only the hash is stored) ----------
export function newChatToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export function tokenMatches(token: string, hash: string): boolean {
  if (typeof token !== "string" || token.length < 20 || token.length > 100) return false;
  const a = Buffer.from(hashToken(token), "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

// ---------- alerts to the admin team ----------
export type AlertKind = "booking" | "visitor_chat" | "client_chat";

/** Where alert emails go: the addresses set in admin, else every admin account. */
async function alertRecipients(): Promise<string[]> {
  const s = await getReplySettings();
  if (s.alertEmails.length) return s.alertEmails;
  const { data } = await createAdminClient().from("profiles").select("email").eq("role", "admin");
  return (data ?? []).map((p) => p.email as string).filter(Boolean);
}

/**
 * Tell the team straight away: an email to each recipient and (unless a
 * database trigger already did it) an in-app alert. Never throws — a
 * failed alert must not break the visitor's booking or chat.
 */
export async function alertTeam(a: {
  kind: AlertKind;
  ref: string;
  title: string;
  lines: string[];
  path: string;
  inApp?: boolean;
}): Promise<void> {
  try {
    if (a.inApp) await createAdminClient().from("admin_alerts").insert({ kind: a.kind, ref: a.ref, title: a.title.slice(0, 300) });
    const { replyHours } = await getReplySettings();
    const mail: BrandedEmail = {
      preheader: a.title,
      title: a.title,
      paragraphs: [...a.lines, `Please reply within ${replyHours} hours — that is what we promise on the website.`],
      button: { label: "Open the Inbox", href: `${site.url}${a.path}` },
      note: "You get this email because you are on the LBH admin team.",
    };
    const to = await alertRecipients();
    await Promise.all(
      to.map((addr) => sendEmail({ to: addr, subject: `LBH — ${a.title}`, text: brandedText(mail), html: brandedHtml(mail) }))
    );
  } catch (e) {
    console.error(`[alert] ${e instanceof Error ? e.message : e}`);
  }
}
