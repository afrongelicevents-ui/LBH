import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "sn", "nd"],
  defaultLocale: "en",
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];

export const localeNames: Record<Locale, string> = {
  en: "English",
  sn: "Shona",
  nd: "Ndebele",
};
