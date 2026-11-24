"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import LocaleDropdown from "@/components/LocaleDropdown";
import LocaleChips from "@/components/ws/LocaleChips";
import Logo from "@/components/ws/Logo";
import ThemeToggle, { ThemeRow } from "@/components/ws/ThemeToggle";
import SignOutButton from "@/components/portal/SignOutButton";
import { signOut } from "@/lib/auth/actions";
import { homeForRole } from "@/lib/auth/roles";
import { ACCOUNT_NAV, HEADER_LINKS, SERVICE_GROUPS, publicNav } from "@/config/siteNav";
import { initialsOf, useAuthProfile, type HeaderProfile } from "@/components/auth/useAuthProfile";

function isActive(pathname: string, href: string) {
  if (href === "/" || href === "/account") return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

function Initials({ profile }: { profile: HeaderProfile }) {
  return (
    <span
      aria-hidden
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-forest text-[13px] font-bold text-white"
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
  logo = null,
  initialProfile = null,
  hiddenAccountKeys = null,
  showProjects = false,
}: {
  /** a custom logo uploaded by the admin; null = the Warm Sand logo */
  logo?: string | null;
  /** passed by signed-in pages so the header never flashes "Log in" */
  initialProfile?: HeaderProfile | null;
  /** account sections with nothing real yet; null = ask the server when the menu is first opened */
  hiddenAccountKeys?: string[] | null;
  /** list "Projects" (only when real LBH project content is published) */
  showProjects?: boolean;
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
    document.documentElement.dataset.menu = "open";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const opener = menuBtnRef.current;
    return () => {
      document.body.style.overflow = prev;
      delete document.documentElement.dataset.menu;
      window.removeEventListener("keydown", onKey);
      opener?.focus();
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
  const [hidden, setHidden] = useState<string[] | null>(hiddenAccountKeys);
  useEffect(() => {
    if (!open || !customer || hidden !== null) return;
    let gone = false;
    fetch("/api/account/sections", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { hidden: [] }))
      .then((j: { hidden?: string[] }) => !gone && setHidden(j.hidden ?? []))
      .catch(() => !gone && setHidden([]));
    return () => {
      gone = true;
    };
  }, [open, customer, hidden]);
  const firstName = profile ? (profile.full_name || profile.email).replace(/^SAMPLE\s+/i, "").split(" ")[0] : "";

  // the home page header floats over the big photo
  const overlay = pathname === "/";
  const iconBtn = overlay
    ? "ws-icon-btn"
    : "inline-flex h-11 w-11 items-center justify-center rounded-full border border-rule bg-paper text-charcoal hover:border-line";

  return (
    <header
      className={overlay ? "absolute inset-x-0 top-0 z-40 text-[#f3ede4]" : "sticky top-0 z-40 border-b border-rule bg-ivory/90 backdrop-blur-md"}
      data-auth={auth.status}
      data-overlay={overlay ? "1" : undefined}
    >
      <div className="ds-wrap flex h-[68px] items-center gap-4 md:h-[76px]">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label={tc("brand")}>
          {overlay ? (
            <span className="flex h-[46px] w-[46px] items-center justify-center rounded-[12px] bg-[rgba(23,18,14,0.55)] backdrop-blur-md">
              {logo ? <Image src={logo} alt="" width={96} height={84} priority className="h-auto w-[38px]" /> : <Logo onPhoto priority className="h-auto w-[38px]" />}
            </span>
          ) : logo ? (
            <Image src={logo} alt="" width={96} height={84} priority className="h-10 w-auto md:h-11" />
          ) : (
            <Logo priority className="h-10 w-auto md:h-11" />
          )}
          <span className={`font-serif text-[1.06rem] font-bold leading-none md:text-[1.25rem] ${overlay ? "" : "text-charcoal"}`}>{tc("brand")}</span>
        </Link>

        <nav aria-label={t("mainNav")} className="ml-6 hidden flex-1 items-center gap-5 whitespace-nowrap xl:flex 2xl:gap-7">
          {HEADER_LINKS.map((l) =>
            l.key === "services" ? (
              <div key={l.key} className="group relative" data-testid="nav-services">
                <Link href={l.href} className={`ds-navlink inline-flex items-center gap-1 ${overlay ? "!text-[#f3ede4]" : ""}`} aria-current={isActive(pathname, l.href) ? "page" : undefined}>
                  {t(`nav.${l.key}`)}
                  <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                    <path d="M2.5 4.5L6 8l3.5-3.5" />
                  </svg>
                </Link>
                <div className="invisible absolute top-full left-[-1rem] z-50 pt-3 opacity-0 transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                  <ul className="w-72 overflow-hidden rounded-[20px] border border-rule bg-paper p-2 text-charcoal shadow-(--shadow-card-hover)">
                    {SERVICE_GROUPS.map((g) => (
                      <li key={g.key}>
                        <Link href={g.href} className="block rounded-[14px] px-4 py-3 hover:bg-sand">
                          <span className="block font-serif text-[1.15rem] font-bold">{t(`groups.${g.key}.title`)}</span>
                          <span className="block text-xs text-slate">{t(`groups.${g.key}.short`)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <Link
                key={l.key}
                href={l.href}
                className={`ds-navlink ${overlay ? "!text-[#f3ede4] hover:opacity-80" : ""}`}
                aria-current={isActive(pathname, l.href) ? "page" : undefined}
              >
                {t(`nav.${l.key}`)}
              </Link>
            )
          )}
        </nav>

        <div className="ml-auto flex items-center gap-2 md:gap-2.5">
          <div className={`hidden md:block ${overlay ? "[&_button]:!text-[#f3ede4]" : ""}`}>
            <LocaleDropdown />
          </div>
          <ThemeToggle onPhoto={overlay} />
          {visitor && (
            <>
              <Link href="/login" className={`ds-navlink hidden px-1.5 whitespace-nowrap lg:inline ${overlay ? "!text-[#f3ede4]" : ""}`} data-testid="header-login">
                {tc("login")}
              </Link>
              <Link href="/signup" className="ds-btn ds-btn-primary hidden min-h-11 px-5 text-sm whitespace-nowrap lg:inline-flex" data-testid="header-signup">
                {tc("createAccount")}
              </Link>
            </>
          )}
          {customer && profile && (
            <Link href="/account" className="flex items-center gap-2" aria-label={t("myAccount")} data-testid="header-account">
              <span className={`hidden text-sm font-semibold whitespace-nowrap lg:inline ${overlay ? "" : "text-charcoal"}`}>{t("myAccount")}</span>
              <Initials profile={profile} />
            </Link>
          )}
          {staffHome && profile && (
            <Link href={staffHome} className="flex items-center gap-2" aria-label={t("staffArea")} data-testid="header-staff">
              <span className={`hidden text-sm font-semibold whitespace-nowrap lg:inline ${overlay ? "" : "text-charcoal"}`}>{t("staffArea")}</span>
              <Initials profile={profile} />
            </Link>
          )}
          <button
            ref={menuBtnRef}
            type="button"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            aria-controls="site-menu"
            className={`${iconBtn} lg:w-auto lg:gap-2 lg:px-4 lg:text-sm lg:font-semibold`}
            data-testid="menu-button"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M4 8h16M4 16h10" />
            </svg>
            <span className="hidden lg:inline">{t("menu")}</span>
            <span className="sr-only lg:hidden">{t("menu")}</span>
          </button>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={t("menu")} id="site-menu">
          <button type="button" aria-label={t("closeMenu")} className="absolute inset-0 bg-[rgba(10,9,7,0.5)]" onClick={() => setOpen(false)} />
          <div className="absolute inset-0 flex flex-col overflow-y-auto bg-ivory text-charcoal shadow-xl sm:inset-y-0 sm:right-0 sm:left-auto sm:w-[440px] sm:rounded-l-[28px]" data-testid="site-menu">
            <div className="flex items-end justify-between gap-3 px-5 pt-6 pb-2 md:px-7">
              <h2 className="font-serif text-[2.25rem] leading-[0.95] font-extrabold tracking-[-0.035em]">{t("menu")}</h2>
              <div className="flex items-center gap-2">
                <Logo className="h-auto w-[52px]" />
                <button
                  ref={closeRef}
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label={t("close")}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-sand text-charcoal hover:bg-paper"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                  <span className="sr-only">{t("close")}</span>
                </button>
              </div>
            </div>

            <div className="flex-1 px-5 pt-4 pb-8 md:px-7">
              {customer && profile && (
                <section aria-labelledby="menu-account" className="mb-8">
                  <p className="mb-1 text-sm text-slate">{t("signedInAs", { name: firstName })}</p>
                  <h3 id="menu-account" className="ds-eyebrow mb-2">{t("yourAccount")}</h3>
                  {hidden === null ? (
                    <p className="py-3 text-sm text-slate" aria-live="polite">{t("loading")}</p>
                  ) : (
                  <ul data-testid="account-menu" className="border-t border-rule">
                    {ACCOUNT_NAV.filter((l) => !hidden.includes(l.key)).map((l) => (
                      <li key={l.key}>
                        <Link
                          href={l.href}
                          className={`flex min-h-[52px] items-center justify-between border-b border-rule font-serif text-[1.05rem] font-bold ${
                            isActive(pathname, l.href) ? "text-forest" : "hover:text-forest"
                          }`}
                          aria-current={isActive(pathname, l.href) ? "page" : undefined}
                        >
                          <span>{t(`account.${l.key}`)}</span>
                          <span aria-hidden className={isActive(pathname, l.href) ? "text-forest" : "text-slate"}>→</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  )}
                </section>
              )}

              {staffHome && (
                <div className="mb-8 flex flex-col gap-3">
                  <Link href={staffHome} className="ds-btn ds-btn-primary w-full">
                    {t("openStaffArea")}
                  </Link>
                  <Link href="/account/settings" className="ds-btn ds-btn-outline w-full">
                    {t("account.settings")}
                  </Link>
                </div>
              )}

              <section aria-labelledby="menu-site">
                <h3 id="menu-site" className="ds-eyebrow mb-2">{customer ? t("website") : t("explore")}</h3>
                <ul className="ws-menu border-t border-rule">
                  {publicNav(showProjects).map((l) => (
                    <li key={l.key}>
                      <Link
                        href={l.href}
                        className={isActive(pathname, l.href) ? "text-forest" : "hover:text-forest"}
                        aria-current={isActive(pathname, l.href) ? "page" : undefined}
                      >
                        <span>{t(`nav.${l.key}`)}</span>
                        <span aria-hidden className="text-slate">→</span>
                      </Link>
                      {l.key === "services" && (
                        <ul className="border-b border-rule py-1.5 pl-4" data-testid="menu-service-groups">
                          {SERVICE_GROUPS.map((g) => (
                            <li key={g.key}>
                              <Link href={g.href} className="flex items-baseline gap-2 py-2 text-[15px] hover:text-forest">
                                <span aria-hidden className="h-px w-3 bg-stone" />
                                <span className="font-semibold">{t(`groups.${g.key}.title`)}</span>
                                <span className="text-xs text-slate">· {t(`groups.${g.key}.short`)}</span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                  {!customer && (
                    <>
                      <li>
                        <Link href="/sample/build-account" className="hover:text-forest" data-testid="menu-sample-ba">
                          <span>{t("sampleBuildAccount")}</span>
                          <span aria-hidden className="text-slate">→</span>
                        </Link>
                      </li>
                      <li>
                        <Link href="/sample/live" className="hover:text-forest" data-testid="menu-sample-live">
                          <span>{t("sampleLive")}</span>
                          <span aria-hidden className="text-slate">→</span>
                        </Link>
                      </li>
                    </>
                  )}
                  <li>
                    <ThemeRow className="border-b border-rule font-serif text-[17px] font-bold" />
                  </li>
                </ul>
              </section>

              <div className="mt-8 flex flex-col gap-3">
                <Link href="/book-a-call" className="ds-btn ds-btn-primary w-full" data-testid="menu-book-call">{t("bookConsultation")}</Link>
                {visitor && (
                  <>
                    <Link href="/signup" className="ds-btn ds-btn-outline w-full">{tc("createAccount")}</Link>
                    <Link href="/login" className="ds-btn ds-btn-outline w-full">{tc("login")}</Link>
                  </>
                )}
                {!visitor && profile && (
                  <div className="text-sm">
                    <SignOutButton action={signOut.bind(null, locale)} label={t("logOut")} />
                  </div>
                )}
              </div>
              <div className="mt-7">
                <span className="ds-eyebrow">{t("language")}</span>
                <div className="mt-2.5">
                  <LocaleChips />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
