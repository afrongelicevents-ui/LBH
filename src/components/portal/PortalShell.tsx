import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { signOut } from "@/lib/auth/actions";
import PortalNav from "./PortalNav";
import PortalMenu from "./PortalMenu";
import Image from "next/image";
import { getCustomLogo } from "@/lib/sitePhotos";
import Logo from "@/components/ws/Logo";
import ThemeToggle from "@/components/ws/ThemeToggle";
import { PortalTabBar } from "@/components/ws/TabBar";
import type { Profile } from "@/lib/supabase/server";
import type { IconName } from "@/components/ui/PortalIcons";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  /** small red count (e.g. new Inbox alerts) */
  badge?: number;
}

export type AreaKey = "client" | "field" | "lawyer" | "admin";

function initials(name: string, email: string): string {
  const words = (name || "").replace(/^SAMPLE\s+/i, "").replace(/\(.*?\)/g, "").trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (email[0] ?? "?").toUpperCase();
}

/** Shared chrome for the client / field / lawyer / admin portals. */
export default async function PortalShell({
  locale,
  profile,
  nav,
  areaKey,
  children,
}: {
  locale: string;
  profile: Profile;
  nav: NavItem[];
  areaKey: AreaKey;
  children: React.ReactNode;
}) {
  const t = await getTranslations("portal.shell");
  const tc = await getTranslations("common");
  const signOutWithLocale = signOut.bind(null, locale);
  const portalName = t(`area.${areaKey}`);
  const display = profile.full_name || profile.email;
  const logo = await getCustomLogo();
  // phones: the main sections in a bottom tab bar (+ Menu); staff with one section also get their settings
  const tabItems = nav.length > 1 ? nav : [...nav, { href: "/account/settings", label: t("settings"), icon: "cog" as const }];

  return (
    <div className="ds-page ds-staff flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-rule bg-ivory/90 backdrop-blur-md">
        <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between gap-3 px-4 sm:h-[76px] sm:px-6 lg:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-2.5 sm:gap-3" aria-label={tc("brand")}>
            {logo ? <Image src={logo} alt="" width={96} height={84} priority className="h-10 w-auto sm:h-11" /> : <Logo priority className="h-10 w-auto sm:h-11" />}
            <span className="min-w-0 leading-tight">
              <span className="block truncate font-serif text-[16px] font-bold text-charcoal sm:text-[1.2rem]">{tc("brand")}</span>
              <span className="block truncate text-[13px] font-semibold text-forest sm:text-sm" data-testid="portal-name">
                {portalName}
              </span>
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
            <span className="hidden max-w-48 truncate text-sm font-medium text-muted md:block" title={profile.email}>
              {display}
            </span>
            <ThemeToggle />
            <span
              className="relative flex h-11 w-11 items-center justify-center rounded-full bg-forest text-sm font-bold text-white"
              title={display}
              aria-label={display}
            >
              {initials(profile.full_name, profile.email)}
              <span aria-hidden className="absolute right-0 bottom-0 h-3 w-3 rounded-full border-2 border-ivory bg-ok-line" />
            </span>
            <PortalMenu
              items={nav}
              name={display}
              email={profile.email}
              portalName={portalName}
              signOutAction={signOutWithLocale}
              labels={{ menu: t("menu"), close: t("closeMenu"), signOut: t("signOut"), website: t("website") }}
            />
          </div>
        </div>
        {nav.length > 1 && (
          <div className="hidden lg:block">
            <PortalNav items={nav} label={portalName} />
          </div>
        )}
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">{children}</main>
      <div className="lg:hidden">
        <PortalTabBar items={tabItems} label={portalName} menuLabel={t("menuTab")} />
      </div>
    </div>
  );
}
