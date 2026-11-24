"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

const names: Record<Locale, string> = { en: "English", sn: "Shona", nd: "Ndebele" };

/** Language as three chips (menus). Remembered in a cookie like the other switchers. */
export default function LocaleChips() {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  return (
    <div className="flex flex-wrap gap-2" role="group">
      {routing.locales.map((l) => (
        <button
          key={l}
          type="button"
          className="chip"
          aria-pressed={l === locale}
          lang={l}
          onClick={() => {
            document.cookie = `NEXT_LOCALE=${l};path=/;max-age=31536000;SameSite=Lax`;
            router.replace(pathname, { locale: l });
          }}
        >
          {names[l]}
        </button>
      ))}
    </div>
  );
}
