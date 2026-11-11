import type { MetadataRoute } from "next";
import { site } from "@/config/site";
import { routing } from "@/i18n/routing";
import { SERVICES } from "@/config/services";

/** Public pages only (portals, admin and sign-in pages are not listed). */
const PAGES = ["", "/services", ...SERVICES.map((s) => `/services/${s.slug}`), "/how-it-works", "/build-account", "/about", "/faq", "/contact", "/book-a-call", "/terms", "/privacy"];

const urlFor = (locale: string, path: string) =>
  `${site.url}${locale === routing.defaultLocale ? "" : `/${locale}`}${path}` || site.url;

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map((path) => ({
    url: urlFor(routing.defaultLocale, path),
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : path === "/services" || path === "/build-account" ? 0.8 : 0.5,
    alternates: {
      languages: Object.fromEntries(routing.locales.map((l) => [l, urlFor(l, path)])),
    },
  }));
}
