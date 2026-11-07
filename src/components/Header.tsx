"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import LocaleSwitcher from "./LocaleSwitcher";
import LocaleDropdown from "./LocaleDropdown";
import { MenuIcon, CloseIcon } from "./icons";

const navItems = [
  { href: "/services", key: "services" },
  { href: "/how-it-works", key: "howItWorks" },
  { href: "/about", key: "about" },
  { href: "/contact", key: "contact" },
] as const;

export default function Header() {
  const t = useTranslations();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white">
      {/* ---------- Mobile: logo · EN ▾ · burger, then the two pills ---------- */}
      <div className="px-4 pt-2 pb-3 lg:hidden">
        <div className="flex items-center justify-between">
          <Link href="/" onClick={() => setOpen(false)} aria-label={t("common.brand")}>
            <Image
              src="/images/logo.jpg"
              alt=""
              width={96}
              height={76}
              priority
              className="h-11 w-auto"
            />
          </Link>
          <div className="flex items-center gap-1">
            <LocaleDropdown />
            <button
              type="button"
              onClick={() => setOpen(!open)}
              aria-expanded={open}
              aria-label={open ? t("common.closeMenu") : t("common.menu")}
              className="flex h-10 w-10 items-center justify-center rounded-full text-forest"
            >
              {open ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>
        <div className="mt-1 flex justify-end gap-2">
          <Link
            href="/login"
            onClick={() => setOpen(false)}
            className="btn btn-outline-green min-h-10 px-4 py-1.5 text-sm"
          >
            {t("common.login")}
          </Link>
          <Link
            href="/book-a-call"
            onClick={() => setOpen(false)}
            className="btn btn-primary min-h-10 px-4 py-1.5 text-sm"
          >
            {t("common.bookCall")}
          </Link>
        </div>
      </div>

      {/* Mobile menu: nav links */}
      {open && (
        <nav aria-label="Main" className="border-t border-line bg-white px-4 pb-4 lg:hidden">
          <ul className="flex flex-col">
            {navItems.map((item) => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block border-b border-line py-3 text-base font-semibold text-ink"
                >
                  {t(`nav.${item.key}`)}
                </Link>
              </li>
            ))}
            <li className="flex gap-5 pt-3 text-sm text-muted">
              <Link href="/terms" onClick={() => setOpen(false)}>{t("nav.terms")}</Link>
              <Link href="/privacy" onClick={() => setOpen(false)}>{t("nav.privacy")}</Link>
            </li>
          </ul>
        </nav>
      )}

      {/* ---------- Desktop ---------- */}
      <div className="mx-auto hidden h-20 max-w-7xl items-center justify-between px-6 lg:flex lg:px-8">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <Image
            src="/images/logo.jpg"
            alt=""
            width={96}
            height={76}
            priority
            className="h-12 w-auto"
          />
          <span aria-hidden className="h-10 w-px bg-line" />
          <span className="truncate text-base font-extrabold tracking-wide text-forest uppercase">
            {t("common.brandUpper")}
          </span>
        </Link>

        <nav aria-label="Main" className="flex items-center gap-7">
          {navItems.map((item) =>
            item.key === "services" ? (
              <div key={item.key} className="group relative">
                <Link
                  href={item.href}
                  className="flex items-center gap-1 text-sm font-semibold text-ink transition-colors hover:text-forest"
                >
                  {t(`nav.${item.key}`)}
                  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M2.5 4.5L6 8l3.5-3.5" />
                  </svg>
                </Link>
                <div className="invisible absolute top-full left-1/2 z-50 w-72 -translate-x-1/2 pt-3 opacity-0 transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                  <ul className="rounded-2xl border border-line bg-white p-2 shadow-lg">
                    {(["land", "materials", "monitoring", "camera"] as const).map((key) => (
                      <li key={key}>
                        <Link
                          href={`/services#${key}`}
                          className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-ink hover:bg-offwhite"
                        >
                          {t(`servicesData.${key}.title`)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <Link
                key={item.key}
                href={item.href}
                className="text-sm font-semibold text-ink transition-colors hover:text-forest"
              >
                {t(`nav.${item.key}`)}
              </Link>
            )
          )}
        </nav>

        <div className="flex items-center gap-5">
          <LocaleSwitcher />
          <Link href="/login" className="btn btn-outline-green px-5 text-sm">
            {t("common.login")}
          </Link>
          <Link href="/book-a-call" className="btn btn-primary px-5 text-sm">
            {t("common.bookCall")}
          </Link>
        </div>
      </div>
    </header>
  );
}
