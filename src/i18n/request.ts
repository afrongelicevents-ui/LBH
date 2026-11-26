import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

type Messages = { [key: string]: unknown };

/** Missing translations fall back to English (Admin → Translations lists what is left to translate). */
function withFallback(base: Messages, local: Messages): Messages {
  const out: Messages = { ...base };
  for (const [k, v] of Object.entries(local)) {
    const b = base[k];
    out[k] = v && typeof v === "object" && b && typeof b === "object" ? withFallback(b as Messages, v as Messages) : v;
  }
  return out;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  const local = (await import(`../../messages/${locale}.json`)).default as Messages;
  const messages = locale === routing.defaultLocale ? local : withFallback((await import("../../messages/en.json")).default as unknown as Messages, local);
  return { locale, messages };
});
