import "server-only";

/**
 * Email abstraction. Uses Resend when RESEND_API_KEY is set; otherwise logs
 * to the server console (local/dev). Phase 6 extends templates + WhatsApp
 * deep links.
 */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
  /** Optional LBH-branded HTML (see emailLayout.ts); text stays as the fallback. */
  html?: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "LBH <noreply@letsbuildhome.co.zw>";

  if (!apiKey) {
    // Local development / tests only: deliver into the local Mailpit inbox so
    // emails can be read and checked (never set in production).
    const devInbox = process.env.DEV_MAILPIT_URL;
    if (devInbox) {
      await fetch(`${devInbox}/api/v1/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          From: { Email: "noreply@letsbuildhome.co.zw", Name: "LBH" },
          To: [{ Email: opts.to }],
          Subject: opts.subject,
          Text: opts.text,
          ...(opts.html ? { HTML: opts.html } : {}),
        }),
      }).catch(() => undefined);
    }
    console.info(
      `[email:dev] to=${opts.to} subject="${opts.subject}"\n${opts.text}`
    );
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [opts.to],
      subject: opts.subject,
      text: opts.text,
      ...(opts.html ? { html: opts.html } : {}),
    }),
  });
  if (!res.ok) {
    console.error(`[email] send failed: ${res.status} ${await res.text()}`);
  }
}
