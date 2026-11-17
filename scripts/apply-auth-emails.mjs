/**
 * Send the LBH-branded auth emails (and, later, custom SMTP) to the live
 * Supabase project through the Management API.
 *
 *   node scripts/apply-auth-emails.mjs              # dry run: shows what would change
 *   node scripts/apply-auth-emails.mjs --templates  # subjects + templates
 *   node scripts/apply-auth-emails.mjs --smtp       # custom SMTP (needs the SMTP_* values below)
 *
 * Needs SUPABASE_ACCESS_TOKEN (a personal access token) and SUPABASE_PROJECT_REF.
 * SMTP values come only from the environment and are never printed:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS,
 *   SMTP_ADMIN_EMAIL (default noreply@letsbuildhome.co.zw), SMTP_SENDER_NAME (default "Let's Build Home")
 *
 * Deploy the site first: the template links use /api/auth/confirm for every
 * email type.
 */
import { EMAILS, render } from "./auth-email-templates.mjs";

const args = new Set(process.argv.slice(2));
const ref = process.env.SUPABASE_PROJECT_REF ?? "rvufnjygmnpkklovwjfl";
const token = process.env.SUPABASE_ACCESS_TOKEN;
const api = `https://api.supabase.com/v1/projects/${ref}/config/auth`;
const headers = { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) };

const body = {};
if (args.has("--templates") || args.size === 0) {
  for (const [name, e] of Object.entries(EMAILS)) {
    body[`mailer_subjects_${name}`] = e.subject;
    body[`mailer_templates_${name}_content`] = render(e);
  }
}
if (args.has("--smtp")) {
  const need = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"];
  const missing = need.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`Missing ${missing.join(", ")} — SMTP not changed.`);
    process.exit(1);
  }
  Object.assign(body, {
    smtp_host: process.env.SMTP_HOST,
    smtp_port: String(process.env.SMTP_PORT),
    smtp_user: process.env.SMTP_USER,
    smtp_pass: process.env.SMTP_PASS,
    smtp_admin_email: process.env.SMTP_ADMIN_EMAIL ?? "noreply@letsbuildhome.co.zw",
    smtp_sender_name: process.env.SMTP_SENDER_NAME ?? "Let's Build Home",
    smtp_max_frequency: 30,
    // the built-in mailer's 2/hour limit no longer applies with your own SMTP
    rate_limit_email_sent: 60,
  });
}

const shown = Object.fromEntries(
  Object.entries(body).map(([k, v]) => [k, k === "smtp_pass" ? "••••" : k.endsWith("_content") ? `<${v.length} chars of HTML>` : v])
);
if (args.size === 0) {
  console.log("Dry run — would send:\n", shown, "\nUse --templates and/or --smtp to apply.");
  process.exit(0);
}
const res = await fetch(api, { method: "PATCH", headers, body: JSON.stringify(body) });
if (!res.ok) {
  console.error(`Supabase refused (${res.status}): ${(await res.text()).slice(0, 300)}`);
  process.exit(1);
}
console.log("Applied:", shown);
