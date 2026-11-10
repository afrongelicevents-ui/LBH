import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import { getSitePhotos } from "@/lib/sitePhotos";
import WhatsAppButton from "@/components/WhatsAppButton";
import { showProjectsInNav } from "@/lib/projects";

/** Public website chrome — the same header, menu and footer as the customer account. */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [photos, showProjects] = await Promise.all([getSitePhotos(), showProjectsInNav()]);
  return (
    <div className="ds-page flex min-h-screen flex-1 flex-col">
      <SiteHeader logo={photos.logo} showProjects={showProjects} />
      <main className="flex-1">{children}</main>
      <SiteFooter logo={photos.logo} />
      <WhatsAppButton />
    </div>
  );
}
