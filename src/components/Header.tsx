"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import LocaleSwitcher from "./LocaleSwitcher";
import LocaleDropdown from "./LocaleDropdown";
import { MenuIcon, CloseIcon } from "./icons";
import { ICONS, UserIcon, HomeIcon, LogOutIcon, CalendarIcon } from "./ui/PortalIcons";
import SignOutButton from "./portal/SignOutButton";
import { signOut } from "@/lib/auth/actions";
import { homeForRole } from "@/lib/auth/roles";
import { areaFor, portalNavFor } from "@/config/portalNav";
import { initialsOf, useAuthProfile, type HeaderProfile } from "./auth/useAuthProfile";

const navItems = [
  { href: "/services", key: "services" },
  { href: "/how-it-works", key: "howItWorks" },
  { href: "/build-account", key: "buildAccount" },
  { href: "/about", key: "about" },
  { href: "/contact", key: "contact" },
] as const;

/** Round initials avatar: tapping it opens the user's own portal. */
function Avatar({ profile, size = "md", onClick }: { profile: HeaderProfile; size?: "md" | "lg"; onClick?: () => void }) {
  const t = useTranslations("account");
  const dim = size === "lg" ? "h-12 w-12 text-base" : "h-10 w-10 text-sm";
  return (
    <Link
      href={homeForRole(profile.role)}
      onClick={onClick}
      aria-label={t("openPortal", { name: profile.full_name || profile.email })}
      title={t("openPortal", { name: profile.full_name || profile.email })}
      data-testid="header-avatar"
      className={`relative flex ${dim} shrink-0 items-center justify-center rounded-full bg-forest font-bold text-white`}
    >
      {initialsOf(profile.full_name, profile.email)}
      <span aria-hidden className="absolute right-0 bottom-0 h-3 w-3 rounded-full border-2 border-white bg-ok-line" />
    </Link>
  );
}

/** Menu content for a signed-in user: profile card, portal pages, website pages, sign out. */
function SignedInMenu({ profile, onNavigate }: { profile: HeaderProfile; onNavigate: () => void }) {
  const t = useTranslations();
  const locale = useLocale();
  const area = areaFor(profile.role, profile.staff_kind);
  return (
    <div data-testid="account-menu">
      <div className="flex items-center gap-3 border-b border-line py-3">
        <Avatar profile={profile} size="lg" onClick={onNavigate} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-ink">{profile.full_name || profile.email}</p>
          <p className="truncate text-xs text-muted">
            {t(`account.role.${area}` as never)} · {profile.email}
          </p>
          <Link href="/account" onClick={onNavigate} className="mt-0.5 inline-flex items-center gap-1 text-xs font-bold text-forest underline underline-offset-2">
            <UserIcon size={14} />
            {t("account.myProfile")}
          </Link>
        </div>
      </div>
      <p className="pt-3 pb-1 text-[11px] font-bold tracking-wide text-muted uppercase">{t(`portal.shell.area.${area}` as never)}</p>
      <ul>
        {portalNavFor(profile.role).map((n) => {
          const Icon = ICONS[n.icon];
          return (
            <li key={n.href}>
              <Link href={n.href} onClick={onNavigate} className="flex items-center gap-3 rounded-lg px-1 py-2.5 text-sm font-semibold text-ink hover:bg-offwhite">
                <Icon size={18} className="text-forest" />
                {t(n.label as never)}
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="pt-3 pb-1 text-[11px] font-bold tracking-wide text-muted uppercase">{t("account.website")}</p>
      <ul>
        <li>
          <Link href="/book-a-call" onClick={onNavigate} className="flex items-center gap-3 rounded-lg px-1 py-2.5 text-sm font-bold text-forest hover:bg-offwhite" data-testid="menu-book-call">
            <CalendarIcon size={18} />
            {t("common.bookCall")}
          </Link>
        </li>
        <li>
          <Link href="/" onClick={onNavigate} className="flex items-center gap-3 rounded-lg px-1 py-2.5 text-sm font-semibold text-ink hover:bg-offwhite">
            <HomeIcon size={18} className="text-forest" />
            {t("account.home")}
          </Link>
        </li>
        {navItems.map((item) => (
          <li key={item.key}>
            <Link href={item.href} onClick={onNavigate} className="block rounded-lg py-2.5 pl-8 text-sm font-semibold text-ink hover:bg-offwhite">
              {t(`nav.${item.key}`)}
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex items-center gap-2 border-t border-line pt-3">
        <LogOutIcon size={18} className="text-muted" />
        <SignOutButton action={signOut.bind(null, locale)} label={t("portal.shell.signOut")} />
      </div>
    </div>
  );
}

export default function Header({ logo = "/images/logo.jpg" }: { logo?: string }) {
  const t = useTranslations();
  const auth = useAuthProfile();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(false);
  const desktopRef = useRef<HTMLDivElement>(null);

  // Close menus when the page changes
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
    setDesktopOpen(false);
  }

  useEffect(() => {
    if (!desktopOpen) return;
    const onDown = (e: MouseEvent) => {
      if (desktopRef.current && !desktopRef.current.contains(e.target as Node)) setDesktopOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDesktopOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [desktopOpen]);

  const signedIn = auth.status === "in" ? auth.profile : null;
  // While the session is being read, guess from the auth cookie so signed-in
  // users don't see a "Log in" row flash (and logged-out users no jump).
  const hasAuthCookie = useSyncExternalStore(
    () => () => {},
    () => /(^|;\s*)sb-[^=]*-auth-token/.test(document.cookie),
    () => false
  );
  const showAuthRow = auth.status === "out" || (auth.status === "loading" && !hasAuthCookie);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white" data-auth={auth.status}>
      {/* ---------- Mobile: logo · EN ▾ · avatar · burger, then the pills ---------- */}
      <div className={`px-4 pt-2 lg:hidden ${showAuthRow ? "pb-3" : "pb-2"}`}>
        <div className="flex items-center justify-between">
          <Link href="/" onClick={() => setOpen(false)} aria-label={t("common.brand")}>
            <Image src={logo} alt="" width={96} height={76} priority className="h-11 w-auto" />
          </Link>
          <div className="flex items-center gap-1.5">
            <LocaleDropdown />
            {signedIn && <Avatar profile={signedIn} />}
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
        {showAuthRow && (
          <div className="mt-1 flex min-h-10 flex-wrap justify-end gap-2">
            {auth.status === "out" && (
              <>
                <Link href="/login" onClick={() => setOpen(false)} className="btn btn-outline-green min-h-10 px-4 py-1.5 text-sm">
                  {t("common.login")}
                </Link>
                <Link href="/signup" onClick={() => setOpen(false)} className="btn btn-outline-green min-h-10 px-4 py-1.5 text-sm">
                  {t("common.createAccount")}
                </Link>
              </>
            )}
          </div>
        )}
      </div>

      {/* Mobile menu */}
      {open && (
        <nav aria-label="Main" className="border-t border-line bg-white px-4 pb-4 lg:hidden">
          {signedIn ? (
            <SignedInMenu profile={signedIn} onNavigate={() => setOpen(false)} />
          ) : (
            <ul className="flex flex-col">
              <li>
                <Link href="/book-a-call" onClick={() => setOpen(false)} className="block border-b border-line py-3 text-base font-bold text-forest" data-testid="menu-book-call">
                  {t("common.bookCall")} →
                </Link>
              </li>
              {navItems.map((item) => (
                <li key={item.key}>
                  <Link href={item.href} onClick={() => setOpen(false)} className="block border-b border-line py-3 text-base font-semibold text-ink">
                    {t(`nav.${item.key}`)}
                  </Link>
                </li>
              ))}
              <li className="flex gap-5 pt-3 text-sm text-muted">
                <Link href="/terms" onClick={() => setOpen(false)}>{t("nav.terms")}</Link>
                <Link href="/privacy" onClick={() => setOpen(false)}>{t("nav.privacy")}</Link>
              </li>
            </ul>
          )}
        </nav>
      )}

      {/* ---------- Desktop ---------- */}
      <div className="mx-auto hidden h-20 max-w-7xl items-center justify-between px-6 lg:flex lg:px-8">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <Image src={logo} alt="" width={96} height={76} priority className="h-12 w-auto" />
          <span aria-hidden className="h-10 w-px bg-line" />
          <span className="truncate text-base font-extrabold tracking-wide text-forest uppercase">
            {t("common.brandUpper")}
          </span>
        </Link>

        <nav aria-label="Main" className="flex items-center gap-7">
          {navItems.map((item) =>
            item.key === "services" ? (
              <div key={item.key} className="group relative">
                <Link href={item.href} className="flex items-center gap-1 text-sm font-semibold text-ink transition-colors hover:text-forest">
                  {t(`nav.${item.key}`)}
                  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M2.5 4.5L6 8l3.5-3.5" />
                  </svg>
                </Link>
                <div className="invisible absolute top-full left-1/2 z-50 w-72 -translate-x-1/2 pt-3 opacity-0 transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                  <ul className="rounded-2xl border border-line bg-white p-2 shadow-lg">
                    {(["land", "materials", "monitoring", "camera"] as const).map((key) => (
                      <li key={key}>
                        <Link href={`/services#${key}`} className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-ink hover:bg-offwhite">
                          {t(`servicesData.${key}.title`)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <Link key={item.key} href={item.href} className="text-sm font-semibold text-ink transition-colors hover:text-forest">
                {t(`nav.${item.key}`)}
              </Link>
            )
          )}
          {/* a plain link (no button) so booking stays reachable from every page */}
          <Link href="/book-a-call" className="text-sm font-bold text-forest underline-offset-4 hover:underline" data-testid="nav-book-call">
            {t("common.bookCall")}
          </Link>
        </nav>

        <div className="flex items-center gap-3 xl:gap-5">
          <LocaleSwitcher />
          {auth.status === "out" && (
            <>
              <Link href="/login" className="btn btn-outline-green px-5 text-sm">
                {t("common.login")}
              </Link>
              <Link href="/signup" className="btn btn-outline-green px-5 text-sm">
                {t("common.createAccount")}
              </Link>
            </>
          )}
          {signedIn && (
            <div ref={desktopRef} className="relative flex items-center gap-2">
              <Avatar profile={signedIn} />
              <button
                type="button"
                onClick={() => setDesktopOpen(!desktopOpen)}
                aria-expanded={desktopOpen}
                aria-label={desktopOpen ? t("common.closeMenu") : t("common.menu")}
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-offwhite text-ink hover:bg-info"
              >
                {desktopOpen ? <CloseIcon /> : <MenuIcon />}
              </button>
              {desktopOpen && (
                <div className="absolute top-full right-0 z-50 mt-2 max-h-[80vh] w-80 overflow-y-auto rounded-2xl border border-line bg-white px-4 pb-3 shadow-(--shadow-card-hover)">
                  <SignedInMenu profile={signedIn} onNavigate={() => setDesktopOpen(false)} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
