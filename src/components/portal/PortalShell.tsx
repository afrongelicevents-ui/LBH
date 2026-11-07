import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { signOut } from "@/lib/auth/actions";
import PortalNav from "./PortalNav";
import PortalMenu from "./PortalMenu";
import type { Profile } from "@/lib/supabase/server";
import type { IconName } from "@/components/ui/PortalIcons";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
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

  return (
    <div className="flex min-h-screen flex-col bg-portal">
      <header className="sticky top-0 z-40 border-b border-[#e6e9e7] bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-3 sm:h-[72px] sm:px-6 lg:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-2.5 sm:gap-3" aria-label={tc("brand")}>
            <Image src="/images/logo.jpg" alt="" width={70} height={58} priority className="h-10 w-auto sm:h-12" />
            <span aria-hidden className="h-9 w-px bg-ink/70 sm:h-10" />
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[15px] font-extrabold text-ink sm:text-lg">{tc("brand")}</span>
              <span className="block truncate text-[13px] font-medium text-muted sm:text-sm" data-testid="portal-name">
                {portalName}
              </span>
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <span className="hidden max-w-48 truncate text-sm font-medium text-muted md:block" title={profile.email}>
              {display}
            </span>
            <span
              className="relative flex h-10 w-10 items-center justify-center rounded-full bg-forest text-sm font-bold text-white sm:h-11 sm:w-11"
              title={display}
              aria-label={display}
            >
              {initials(profile.full_name, profile.email)}
              <span aria-hidden className="absolute right-0 bottom-0 h-3 w-3 rounded-full border-2 border-white bg-ok-line" />
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
        {nav.length > 1 && <PortalNav items={nav} label={portalName} />}
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-4 sm:px-6 sm:py-6 lg:px-8">{children}</main>
    </div>
  );
}
