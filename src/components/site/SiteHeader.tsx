"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import LocaleDropdown from "@/components/LocaleDropdown";
import SignOutButton from "@/components/portal/SignOutButton";
import { signOut } from "@/lib/auth/actions";
import { homeForRole } from "@/lib/auth/roles";
import { ACCOUNT_NAV, HEADER_LINKS, PUBLIC_NAV } from "@/config/siteNav";
import { initialsOf, useAuthProfile, type HeaderProfile } from "@/components/auth/useAuthProfile";

function isActive(pathname: string, href: string) {
  if (href === "/" || href === "/account") return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

function Initials({ profile }: { profile: HeaderProfile }) {
  return (
    <span
      aria-hidden
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forest text-[13px] font-semibold text-white"
    >
      {initialsOf(profile.full_name, profile.email)}
    </span>
  );
}

/**
 * One header for the whole site — visitors and signed-in customers alike.
 * The ☰ menu is the main navigation: it shows the customer's account pages
 * when they are signed in, and the website pages for everyone.
 */
export default function SiteHeader({
  logo = "/images/logo.jpg",
  initialProfile = null,
}: {
  logo?: string;
  /** passed by signed-in pages so the header never flashes "Log in" */
  initialProfile?: HeaderProfile | null;
}) {
  const t = useTranslations("site");
  const tc = useTranslations("common");
  const locale = useLocale();
  const auth = useAuthProfile();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  // close on navigation
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      menuBtnRef.current?.focus();
    };
  }, [open]);

  const profile: HeaderProfile | null =
    auth.status === "in" ? auth.profile : auth.status === "loading" ? initialProfile : null;
  const hasAuthCookie = useSyncExternalStore(
    () => () => {},
    () => /(^|;\s*)sb-[^=]*-auth-token/.test(document.cookie),
    () => false
  );
  const visitor = !profile && (auth.status === "out" || (auth.status === "loading" && !hasAuthCookie && !initialProfile));
  const customer = profile?.role === "client";
  const staffHome = profile && !customer ? homeForRole(profile.role) : null;
  const firstName = profile ? (profile.full_name || profile.email).replace(/^SAMPLE\s+/i, "").split(" ")[0] : "";

  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-ivory" data-auth={auth.status}>
      <div className="ds-wrap flex h-16 items-center gap-4 md:h-[72px]">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label={tc("brand")}>
          <Image src={logo} alt="" width={96} height={76} priority className="h-9 w-auto md:h-10" />
          <span className="font-serif text-[1.15rem] leading-none text-forest md:text-[1.3rem]">{tc("brand")}</span>
        </Link>

        <nav aria-label={t("mainNav")} className="ml-8 hidden flex-1 items-center gap-6 whitespace-nowrap xl:gap-8 lg:flex">
          {HEADER_LINKS.map((l) => (
            <Link
              key={l.key}
              href={l.href}
              className="ds-navlink"
              aria-current={isActive(pathname, l.href) ? "page" : undefined}
            >
              {t(`nav.${l.key}`)}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 md:gap-3">
          <div className="hidden md:block">
            <LocaleDropdown />
          </div>
          {visitor && (
            <>
              <Link href="/login" className="ds-navlink px-1.5" data-testid="header-login">
                {tc("login")}
              </Link>
              <Link href="/signup" className="ds-btn ds-btn-primary hidden min-h-10 px-4 py-2 text-sm sm:inline-flex" data-testid="header-signup">
                {tc("createAccount")}
              </Link>
            </>
          )}
          {customer && profile && (
            <Link href="/account" className="flex items-center gap-2" aria-label={t("myAccount")} data-testid="header-account">
              <span className="hidden text-sm font-medium text-charcoal md:inline">{t("myAccount")}</span>
              <Initials profile={profile} />
            </Link>
          )}
          {staffHome && profile && (
            <Link href={staffHome} className="flex items-center gap-2" aria-label={t("staffArea")}>
              <span className="hidden text-sm font-medium text-charcoal md:inline">{t("staffArea")}</span>
              <Initials profile={profile} />
            </Link>
          )}
          <button
            ref={menuBtnRef}
            type="button"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            aria-controls="site-menu"
            className="flex h-10 items-center gap-2 rounded-[4px] border border-rule px-3 text-sm font-medium text-charcoal hover:border-charcoal"
            data-testid="menu-button"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
            <span className="hidden sm:inline">{t("menu")}</span>
            <span className="sr-only sm:hidden">{t("menu")}</span>
          </button>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={t("menu")} id="site-menu">
          <button type="button" aria-label={t("closeMenu")} className="absolute inset-0 bg-charcoal/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 right-0 flex w-full max-w-[420px] flex-col overflow-y-auto bg-paper shadow-xl" data-testid="site-menu">
            <div className="flex h-16 items-center justify-between border-b border-rule px-5 md:h-[72px] md:px-7">
              <span className="font-serif text-lg text-forest">{t("menu")}</span>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-10 items-center gap-2 rounded-[4px] px-2 text-sm font-medium text-charcoal hover:bg-sand"
              >
                {t("close")}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <div className="flex-1 px-5 py-6 md:px-7">
              {customer && profile && (
                <section aria-labelledby="menu-account" className="mb-8">
                  <p className="mb-1 text-sm text-slate">{t("signedInAs", { name: firstName })}</p>
                  <h2 id="menu-account" className="ds-eyebrow mb-2">{t("yourAccount")}</h2>
                  <ul>
                    {ACCOUNT_NAV.map((l) => (
                      <li key={l.key}>
                        <Link
                          href={l.href}
                          className={`flex items-center justify-between border-b border-rule py-3 text-[15px] ${
                            isActive(pathname, l.href) ? "font-semibold text-forest" : "text-charcoal hover:text-forest"
                          }`}
                          aria-current={isActive(pathname, l.href) ? "page" : undefined}
                        >
                          {t(`account.${l.key}`)}
                          {isActive(pathname, l.href) && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-forest" />}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {staffHome && (
                <Link href={staffHome} className="ds-btn ds-btn-primary mb-8 w-full">
                  {t("openStaffArea")}
                </Link>
              )}

              <section aria-labelledby="menu-site">
                <h2 id="menu-site" className="ds-eyebrow mb-2">{customer ? t("website") : t("explore")}</h2>
                <ul>
                  {PUBLIC_NAV.map((l) => (
                    <li key={l.key}>
                      <Link
                        href={l.href}
                        className={`block border-b border-rule py-3 text-[15px] ${
                          isActive(pathname, l.href) ? "font-semibold text-forest" : "text-charcoal hover:text-forest"
                        }`}
                        aria-current={isActive(pathname, l.href) ? "page" : undefined}
                      >
                        {t(`nav.${l.key}`)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>

              <div className="mt-8 flex flex-col gap-3">
                {visitor && (
                  <>
                    <Link href="/signup" className="ds-btn ds-btn-primary w-full">{tc("createAccount")}</Link>
                    <Link href="/login" className="ds-btn ds-btn-outline w-full">{tc("login")}</Link>
                  </>
                )}
                {!visitor && profile && (
                  <div className="text-sm">
                    <SignOutButton action={signOut.bind(null, locale)} label={t("logOut")} />
                  </div>
                )}
                <div className="pt-2 md:hidden">
                  <LocaleDropdown />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
