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
  // E.164 digits only, no "+" (used in wa.me links). Until the real number is
  // set (NEXT_PUBLIC_WHATSAPP_NUMBER in Vercel), every WhatsApp button and
  // link is hidden — nobody is ever sent to a placeholder number.
  whatsappNumber: (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "").replace(/[^0-9]/g, "") || null,
} as const;

/** LBH WhatsApp link, or null while no number is set (then show nothing). */
export function waLink(prefilledText?: string): string | null {
  if (!site.whatsappNumber) return null;
  const base = `https://wa.me/${site.whatsappNumber}`;
  return prefilledText ? `${base}?text=${encodeURIComponent(prefilledText)}` : base;
}
