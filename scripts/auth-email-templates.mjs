/**
 * LBH-branded Supabase Auth emails, generated from one layout so they stay
 * consistent. Run `node scripts/auth-email-templates.mjs` to (re)write
 * supabase/templates/*.html. scripts/apply-auth-emails.mjs sends them to the
 * live project.
 *
 * Every link goes to {{ .SiteURL }} (https://letsbuildhome.co.zw), where
 * /api/auth/confirm checks the one-time token and opens the right page.
 * Supabase fills in {{ .SiteURL }}, {{ .TokenHash }}, {{ .Email }}, {{ .NewEmail }}, {{ .Data }}.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const FOREST = "#163a2b";
const IVORY = "#f5f1e8";
const PAPER = "#fbf9f4";
const CHARCOAL = "#23261f";
const SLATE = "#565b52";
const RULE = "#ddd5c4";
const LOGO = "{{ .SiteURL }}/images/logo.jpg";
const link = (type, next) => `{{ .SiteURL }}/api/auth/confirm?token_hash={{ .TokenHash }}&type=${type}&next=${next}`;
const hi = `Hi{{ if .Data.full_name }} {{ .Data.full_name }}{{ end }},`;

export const EMAILS = {
  confirmation: {
    subject: "Confirm your Let's Build Home account",
    preheader: "One tap to confirm your email and open your account.",
    title: "Welcome to Let's Build Home",
    body: [hi, "Thanks for creating your account. Please confirm your email address so we know it's really you — then your account is ready."],
    button: "Confirm my email",
    href: link("signup", "/account"),
    note: "This link works once and expires in 1 hour. If you didn't create an account, you can ignore this email.",
  },
  recovery: {
    subject: "Reset your Let's Build Home password",
    preheader: "Choose a new password for your account.",
    title: "Reset your password",
    body: [hi, "We received a request to reset the password for your Let's Build Home account. Tap the button to choose a new one."],
    button: "Choose a new password",
    href: link("recovery", "/account/password"),
    note: "This link works once and expires in 1 hour. If you didn't ask for this, you can ignore this email — your password stays the same.",
  },
  magic_link: {
    subject: "Your Let's Build Home sign-in link",
    preheader: "Tap to sign in — no password needed.",
    title: "Sign in to your account",
    body: [hi, "Here is your sign-in link. Tap the button to open your Let's Build Home account."],
    button: "Sign in",
    href: link("magiclink", "/account"),
    note: "This link works once and expires in 1 hour. If you didn't ask to sign in, you can ignore this email.",
  },
  email_change: {
    subject: "Confirm your new email address",
    preheader: "Confirm the change to your account email.",
    title: "Confirm your new email",
    body: [hi, "Please confirm that you want to change the email address of your Let's Build Home account from {{ .Email }} to {{ .NewEmail }}."],
    button: "Confirm the change",
    href: link("email_change", "/account"),
    note: "If you didn't ask for this change, don't tap the button and let us know straight away.",
  },
  invite: {
    subject: "You're invited to Let's Build Home",
    preheader: "Set your password to open your account.",
    title: "You're invited",
    body: ["Hello,", "You've been invited to a Let's Build Home account. Tap the button to choose your password and open your account."],
    button: "Accept the invitation",
    href: link("invite", "/account/password"),
    note: "This link works once and expires in 24 hours. If you weren't expecting this, you can ignore this email.",
  },
};

export function render(e) {
  const paras = e.body
    .map((p) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:${CHARCOAL};">${p}</p>`)
    .join("\n              ");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${e.subject}</title>
</head>
<body style="margin:0;padding:0;background:${IVORY};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${e.preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${IVORY};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
          <tr>
            <td style="padding:0 4px 20px;">
              <a href="{{ .SiteURL }}" style="text-decoration:none;">
                <img src="${LOGO}" width="48" height="38" alt="" style="vertical-align:middle;border:0;border-radius:4px;background:#fff;">
                <span style="vertical-align:middle;margin-left:10px;font-family:Georgia,'Times New Roman',serif;font-size:21px;color:${FOREST};">Let's Build Home</span>
              </a>
            </td>
          </tr>
          <tr>
            <td style="background:${PAPER};border:1px solid ${RULE};border-top:4px solid ${FOREST};border-radius:6px;padding:32px 28px;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
              <h1 style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-weight:normal;font-size:28px;line-height:1.2;color:${CHARCOAL};">${e.title}</h1>
              ${paras}
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 22px;">
                <tr>
                  <td style="background:${FOREST};border-radius:4px;">
                    <a href="${e.href}" style="display:inline-block;padding:14px 26px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;">${e.button} &rarr;</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:14px;line-height:1.55;color:${SLATE};">${e.note}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 4px 0;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:12px;line-height:1.6;color:${SLATE};">
              Let's Build Home &middot; Construction oversight in Zimbabwe<br>
              <a href="{{ .SiteURL }}" style="color:${FOREST};">letsbuildhome.co.zw</a> &middot; This is an automatic email, please don't reply to it.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = join(process.cwd(), "supabase", "templates");
  mkdirSync(dir, { recursive: true });
  for (const [name, e] of Object.entries(EMAILS)) {
    writeFileSync(join(dir, `${name}.html`), render(e));
    console.log(`wrote supabase/templates/${name}.html`);
  }
}
