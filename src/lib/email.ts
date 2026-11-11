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
