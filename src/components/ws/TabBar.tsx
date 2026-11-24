"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useAuthProfile, type HeaderProfile } from "@/components/auth/useAuthProfile";
import { homeForRole } from "@/lib/auth/roles";
import { ICONS, type IconName } from "@/components/ui/PortalIcons";

/* ---------- icons (Warm Sand prototype) ---------- */
const P = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
export const TabIcons = {
  home: <svg {...P}><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z" /></svg>,
  services: <svg {...P}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>,
  how: <svg {...P}><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01" /></svg>,
  user: <svg {...P}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>,
  live: <svg {...P}><path d="m22 8-6 4 6 4V8Z" /><rect x="2" y="6" width="14" height="12" rx="2" /></svg>,
  build: <svg {...P}><path d="M3 21h18M5 21V10l7-5 7 5v11" /><path d="M9 21v-6h6v6" /></svg>,
  menu: <svg {...P}><path d="M4 7h16M4 12h16M4 17h10" /></svg>,
  plus: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M12 5v14M5 12h14" /></svg>,
};

export interface TabDef {
  href?: string;
  label: string;
  icon: React.ReactNode;
  /** the round "+" button in the middle */
  book?: boolean;
  badge?: number;
  /** extra paths that count as this tab */
  match?: string[];
  /** custom click instead of a link (e.g. open the menu) */
  event?: string;
  testId?: string;
}

function activeHref(pathname: string, tabs: TabDef[]): string | undefined {
  const all = tabs.flatMap((t) => (t.href ? [t.href, ...(t.match ?? [])].map((p) => ({ p, href: t.href! })) : []));
  const hit = all
    .filter(({ p }) => (p === "/" || p === "/account" || p === "/admin" || p === "/field" ? pathname === p : pathname === p || pathname.startsWith(p + "/")))
    .sort((a, b) => b.p.length - a.p.length)[0];
  return hit?.href;
}

/** App-style bottom tab bar (phones and tablets; hidden on desktop). */
export function TabBar({ tabs, label }: { tabs: TabDef[]; label: string }) {
  const pathname = usePathname();
  const active = activeHref(pathname, tabs);
  return (
    <>
      <div aria-hidden className="ws-tabs-spacer" />
      <nav className="ws-tabs" aria-label={label} data-testid="tab-bar">
        {tabs.map((t) => {
          if (t.book)
            return (
              <Link key="book" href={t.href!} className="ws-tab-book" aria-label={t.label} data-testid={t.testId ?? "tab-book"}>
                {TabIcons.plus}
              </Link>
            );
          const inner = (
            <>
              {t.icon}
              <span>{t.label}</span>
              {t.badge ? <span className="ws-tab-badge" data-testid="tab-badge">{t.badge > 99 ? "99+" : t.badge}</span> : null}
            </>
          );
          if (t.event)
            return (
              <button key={t.label} type="button" className="ws-tab" onClick={() => window.dispatchEvent(new Event(t.event!))} data-testid={t.testId}>
                {inner}
              </button>
            );
          return (
            <Link key={t.href} href={t.href!} className="ws-tab" aria-current={t.href === active ? "page" : undefined} data-testid={t.testId}>
              {inner}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

/**
 * Website + customer account tabs.
 * Visitors: Home, Services, Book (+), How it works, Sign in.
 * Customers: Home, Live, Book (+), My build, Services.
 */
export function SiteTabBar({ initialProfile = null }: { initialProfile?: HeaderProfile | null }) {
  const t = useTranslations("site.tabs");
  const auth = useAuthProfile();
  const profile = auth.status === "in" ? auth.profile : auth.status === "loading" ? initialProfile : null;
  let tabs: TabDef[];
  if (profile?.role === "client") {
    tabs = [
      { href: "/account", label: t("home"), icon: TabIcons.home, testId: "tab-home" },
      { href: "/account/updates", label: t("live"), icon: TabIcons.live, match: ["/account/photos"], testId: "tab-live" },
      { href: "/book-a-call", label: t("book"), icon: null, book: true },
      { href: "/account/progress", label: t("myBuild"), icon: TabIcons.build, match: ["/account/build-account", "/account/projects", "/account/finance"], testId: "tab-mybuild" },
      { href: "/services", label: t("services"), icon: TabIcons.services, testId: "tab-services" },
    ];
  } else {
    const staffHome = profile ? homeForRole(profile.role) : null;
    tabs = [
      { href: "/", label: t("home"), icon: TabIcons.home, testId: "tab-home" },
      { href: "/services", label: t("services"), icon: TabIcons.services, testId: "tab-services" },
      { href: "/book-a-call", label: t("book"), icon: null, book: true },
      { href: "/how-it-works", label: t("how"), icon: TabIcons.how, match: ["/about", "/faq"], testId: "tab-how" },
      staffHome
        ? { href: staffHome, label: t("myArea"), icon: TabIcons.user, testId: "tab-account" }
        : { href: "/login", label: t("signIn"), icon: TabIcons.user, match: ["/signup"], testId: "tab-account" },
    ];
  }
  return <TabBar tabs={tabs} label={t("label")} />;
}

/** Staff portals: their main sections + Menu (opens the full portal menu). */
export function PortalTabBar({ items, label, menuLabel }: { items: { href: string; label: string; icon: IconName; badge?: number }[]; label: string; menuLabel: string }) {
  const tabs: TabDef[] = items.slice(0, 4).map((i) => {
    const Icon = ICONS[i.icon];
    return { href: i.href, label: i.label, icon: <Icon size={22} />, badge: i.badge };
  });
  tabs.push({ label: menuLabel, icon: TabIcons.menu, event: "lbh:open-portal-menu", testId: "tab-menu" });
  return <TabBar tabs={tabs} label={label} />;
}
