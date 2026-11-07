"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

const labels: Record<Locale, string> = {
  en: "EN",
  sn: "Shona",
  nd: "Ndebele",
};

/** Cookie remembers the choice across visits (brief §9). */
function rememberLocale(next: Locale) {
  document.cookie = `NEXT_LOCALE=${next};path=/;max-age=31536000;SameSite=Lax`;
}

export default function LocaleSwitcher({ light = false }: { light?: boolean }) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  function switchTo(next: Locale) {
    rememberLocale(next);
    router.replace(pathname, { locale: next });
  }

  return (
    <div
      className={`flex items-center text-sm font-semibold ${
        light ? "text-white" : "text-forest"
      }`}
    >
      {routing.locales.map((l, i) => (
        <span key={l} className="flex items-center">
          {i > 0 && (
            <span aria-hidden className={light ? "mx-1.5 text-white/40" : "mx-1.5 text-line"}>
              |
            </span>
          )}
          <button
            type="button"
            onClick={() => switchTo(l)}
            aria-current={l === locale ? "true" : undefined}
            className={`min-h-11 cursor-pointer px-0.5 transition-colors ${
              l === locale
                ? `font-extrabold underline underline-offset-4 ${light ? "text-white" : "text-accent"}`
                : light
                  ? "text-white/80 hover:text-white"
                  : "text-muted hover:text-accent"
            }`}
          >
            {labels[l]}
          </button>
        </span>
      ))}
    </div>
  );
}
