import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { signOut } from "@/lib/auth/actions";
import PortalNav from "./PortalNav";
import type { Profile } from "@/lib/supabase/server";

interface NavItem {
  href: string;
  label: string;
}

/** Shared chrome for the client / field / admin areas. */
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
  areaKey: "client" | "field" | "admin";
  children: React.ReactNode;
}) {
  const t = await getTranslations("portal.shell");
  const signOutWithLocale = signOut.bind(null, locale);

  return (
    <div className="flex min-h-screen flex-col bg-offwhite">
      <header className="sticky top-0 z-40 border-b border-line bg-white">
        <div className="mx-auto flex h-12 max-w-7xl items-center justify-between gap-3 px-3 sm:h-14 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/images/logo.jpg" alt="" width={60} height={48} className="h-9 w-auto" />
            <span className="hidden text-xs font-extrabold tracking-wide text-forest uppercase sm:block">
              LBH · {t(`area.${areaKey}`)}
            </span>
          </Link>
          <div className="flex min-w-0 items-center gap-3">
            <span className="truncate text-xs font-semibold text-muted" title={profile.email}>
              {profile.full_name || profile.email}
            </span>
            <form action={signOutWithLocale}>
              <button
                type="submit"
                className="btn btn-outline-green min-h-10 px-3.5 py-1 text-xs"
              >
                {t("signOut")}
              </button>
            </form>
          </div>
        </div>
        <PortalNav items={nav} label={t(`area.${areaKey}`)} />
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
