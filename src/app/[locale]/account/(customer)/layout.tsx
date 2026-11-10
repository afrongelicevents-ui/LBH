import { setRequestLocale } from "next-intl/server";
import { requireRole } from "@/lib/auth/guard";
import { getSitePhotos } from "@/lib/sitePhotos";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import WhatsAppButton from "@/components/WhatsAppButton";
import { showProjectsInNav } from "@/lib/projects";
import { emptySections, loadAccount } from "@/lib/account/data";

/**
 * Customer account: the SAME header, ☰ menu and footer as the public website,
 * so signing in never feels like leaving LBH. Access is still checked on the
 * server (clients only) and by the database's row-level security.
 */
export default async function AccountLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { profile, supabase } = await requireRole(locale, ["client"]);
  const hidden = emptySections(await loadAccount(supabase));
  const [photos, showProjects] = await Promise.all([getSitePhotos(), showProjectsInNav()]);
  return (
    <div className="ds-page flex min-h-screen flex-1 flex-col">
      <SiteHeader
        logo={photos.logo}
        showProjects={showProjects}
        hiddenAccountKeys={hidden}
        initialProfile={{ id: profile.id, role: profile.role, full_name: profile.full_name, email: profile.email, staff_kind: profile.staff_kind }}
      />
      <main className="flex-1 pb-16">
        <div className="ds-wrap pt-6 md:pt-10">{children}</div>
      </main>
      <SiteFooter logo={photos.logo} />
      <WhatsAppButton />
    </div>
  );
}
