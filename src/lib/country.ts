import { z } from "zod";

/**
 * Country of residence. The usual ones are a choice; "Other" asks the
 * person to type their country, and that typed name is what is stored —
 * so LBH always knows where clients are (no anonymous "other").
 */
export const KNOWN_COUNTRIES = ["uk", "usa", "sa", "zw"] as const;
export type KnownCountry = (typeof KNOWN_COUNTRIES)[number];

const NAME_RE = /^[\p{L}][\p{L}\p{M} .,'’()-]{1,59}$/u;

/**
 * "  united   arab emirates " → "United Arab Emirates". Names typed with
 * their own capitals ("Côte d'Ivoire", "USA") are kept as typed.
 */
export function cleanCountryName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, " ");
  if (name !== name.toLowerCase()) return name;
  return name.replace(/(^|\s)(\p{L})/gu, (_m, sp: string, ch: string) => sp + ch.toUpperCase());
}

export function isKnownCountry(v: string | null | undefined): v is KnownCountry {
  return !!v && (KNOWN_COUNTRIES as readonly string[]).includes(v);
}

/** Zod fields for forms with the country picker (+ "Other: type it"). */
export const countryFields = {
  country: z.enum([...KNOWN_COUNTRIES, "other"]),
  country_other: z.string().trim().max(60).optional().default(""),
};

/** Value to store: the code, or the typed country name for "Other". */
export function resolveCountry(d: { country: string; country_other?: string }): string | null {
  if (d.country !== "other") return d.country;
  const name = cleanCountryName(d.country_other ?? "");
  return NAME_RE.test(name) ? name : null;
}

/** Zod check: "Other" needs a real country name (error on country_other). */
export function refineCountry<T extends { country: string; country_other?: string }>(d: T, ctx: z.RefinementCtx) {
  if (d.country === "other" && resolveCountry(d) === null) {
    ctx.addIssue({ code: "custom", path: ["country_other"], message: "country required" });
  }
}

const LABEL_KEY: Record<KnownCountry, string> = {
  uk: "countryUK",
  usa: "countryUSA",
  sa: "countrySA",
  zw: "countryZW",
};

/** Readable country for admin screens (bookPage.* labels for known codes). */
export function countryLabel(
  value: string | null | undefined,
  tBook: (key: string) => string,
  notSpecified: string
): string {
  if (!value) return "—";
  if (isKnownCountry(value)) return tBook(LABEL_KEY[value]);
  if (value === "other") return notSpecified; // from before typed countries
  return value;
}
