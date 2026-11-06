/**
 * Site-wide configuration.
 *
 * Contact details are OPEN ITEMS (brief §15) — placeholders until the owner
 * provides the real domain, email and WhatsApp number. In later phases these
 * move into admin-editable settings stored in the database; env vars override
 * the placeholders in the meantime.
 */
export const site = {
  name: "Let's Build Home",
  shortName: "LBH",
  // Placeholder domain — not chosen yet (brief §13).
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://letsbuildhome.co.zw",
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "info@letsbuildhome.co.zw",
  // E.164 digits only, no "+" (used in wa.me links). Placeholder until provided.
  whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "263770000000",
} as const;

export function waLink(prefilledText?: string): string {
  const base = `https://wa.me/${site.whatsappNumber}`;
  return prefilledText ? `${base}?text=${encodeURIComponent(prefilledText)}` : base;
}
