import "server-only";
import { site } from "@/config/site";

/**
 * The LBH email look (same as the Supabase auth emails in
 * scripts/auth-email-templates.mjs): ivory page, logo, forest-green button.
 * Every value is escaped — names and other text come from forms.
 */
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export interface BrandedEmail {
  preheader: string;
  title: string;
  paragraphs: string[];
  button?: { label: string; href: string };
  note?: string;
}

export function brandedHtml(e: BrandedEmail): string {
  const p = (t: string) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:#2a1e16;">${esc(t)}</p>`;
  const button = e.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 22px;"><tr><td style="background:#b5552f;border-radius:4px;">
<a href="${esc(e.button.href)}" style="display:inline-block;padding:14px 26px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;">${esc(e.button.label)} &rarr;</a></td></tr></table>`
    : "";
  const note = e.note ? `<p style="margin:0;font-size:14px;line-height:1.55;color:#76675a;">${esc(e.note)}</p>` : "";
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(e.title)}</title></head>
<body style="margin:0;padding:0;background:#f1ece5;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(e.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1ece5;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
<tr><td style="padding:0 4px 20px;"><a href="${site.url}" style="text-decoration:none;"><img src="${site.url}/images/brand/logo-on-light.png" width="46" height="40" alt="" style="vertical-align:middle;border:0;"><span style="vertical-align:middle;margin-left:10px;font-family:Georgia,'Times New Roman',serif;font-size:21px;color:#b5552f;">Let's Build Home</span></a></td></tr>
<tr><td style="background:#faf7f3;border:1px solid #e6dcd0;border-top:4px solid #b5552f;border-radius:6px;padding:32px 28px;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
<h1 style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-weight:normal;font-size:28px;line-height:1.2;color:#2a1e16;">${esc(e.title)}</h1>
${e.paragraphs.map(p).join("\n")}
${button}
${note}
</td></tr>
<tr><td style="padding:20px 4px 0;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:12px;line-height:1.6;color:#76675a;">Let's Build Home &middot; Construction oversight in Zimbabwe<br><a href="${site.url}" style="color:#b5552f;">letsbuildhome.co.zw</a> &middot; This is an automatic email, please don't reply to it.</td></tr>
</table></td></tr></table></body></html>`;
}

/** Plain-text twin of the same email (for mail apps that don't show HTML). */
export function brandedText(e: BrandedEmail): string {
  return [
    e.title,
    "",
    ...e.paragraphs.flatMap((p) => [p, ""]),
    ...(e.button ? [`${e.button.label}: ${e.button.href}`, ""] : []),
    ...(e.note ? [e.note, ""] : []),
    "Let's Build Home · letsbuildhome.co.zw",
  ].join("\n");
}

/** A Supabase invite link that opens on our own site (like the auth emails). */
export function inviteLink(hashedToken: string | undefined): string | null {
  return hashedToken ? `${site.url}/api/auth/confirm?token_hash=${hashedToken}&type=invite&next=/account/password` : null;
}
