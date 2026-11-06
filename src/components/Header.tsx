"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import LocaleSwitcher from "./LocaleSwitcher";
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
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:h-20 lg:px-8">
        {/* Logo + divider + wordmark */}
        <Link
          href="/"
          className="flex min-w-0 items-center gap-3"
          onClick={() => setOpen(false)}
        >
          <Image
            src="/images/logo.jpg"
            alt=""
            width={88}
            height={70}
            priority
            className="h-10 w-auto max-h-11 lg:h-12"
          />
          <span aria-hidden className="hidden h-8 w-px bg-gold sm:block lg:h-10" />
          <span className="truncate text-sm font-extrabold tracking-wide text-forest uppercase lg:text-base">
            {t("common.brandUpper")}
          </span>
        </Link>

        {/* Desktop nav */}
        <nav aria-label="Main" className="hidden items-center gap-7 lg:flex">
          {navItems.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className="text-sm font-semibold text-ink transition-colors hover:text-forest"
            >
              {t(`nav.${item.key}`)}
            </Link>
          ))}
        </nav>

        {/* Desktop right side */}
        <div className="hidden items-center gap-5 lg:flex">
          <LocaleSwitcher />
          <Link href="/login" className="btn btn-outline-green px-5 text-sm">
            {t("common.login")}
          </Link>
          <Link href="/book-a-call" className="btn btn-gold px-5 text-sm">
            {t("common.bookCall")}
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label={open ? t("common.closeMenu") : t("common.menu")}
          className="flex h-11 w-11 items-center justify-center rounded-full text-forest lg:hidden"
        >
          {open ? <CloseIcon /> : <MenuIcon />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <nav
          aria-label="Main"
          className="border-t border-line bg-white px-4 pb-6 lg:hidden"
        >
          <ul className="flex flex-col">
            {navItems.map((item) => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block border-b border-line py-3.5 text-base font-semibold text-ink"
                >
                  {t(`nav.${item.key}`)}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-col gap-3">
            <Link
              href="/book-a-call"
              onClick={() => setOpen(false)}
              className="btn btn-gold w-full"
            >
              {t("common.bookCall")}
            </Link>
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="btn btn-outline-green w-full"
            >
              {t("common.login")}
            </Link>
            <div className="mt-2 flex justify-center">
              <LocaleSwitcher />
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
