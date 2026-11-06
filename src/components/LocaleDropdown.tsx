"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

const labels: Record<Locale, string> = { en: "EN", sn: "Shona", nd: "Ndebele" };

function rememberLocale(next: Locale) {
  document.cookie = `NEXT_LOCALE=${next};path=/;max-age=31536000;SameSite=Lax`;
}

/** Compact "EN ▾" dropdown used in the mobile header. */
export default function LocaleDropdown() {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex min-h-10 items-center gap-1 px-2 text-sm font-bold text-forest"
      >
        {labels[locale]}
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M2.5 4.5L6 8l3.5-3.5" />
        </svg>
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute right-0 z-50 mt-1 w-32 overflow-hidden rounded-xl border border-line bg-white py-1 shadow-lg"
        >
          {routing.locales.map((l) => (
            <li key={l}>
              <button
                type="button"
                role="option"
                aria-selected={l === locale}
                onClick={() => {
                  rememberLocale(l);
                  setOpen(false);
                  router.replace(pathname, { locale: l });
                }}
                className={`block w-full px-4 py-2.5 text-left text-sm font-semibold ${
                  l === locale ? "bg-offwhite text-gold" : "text-ink"
                }`}
              >
                {labels[l]}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
