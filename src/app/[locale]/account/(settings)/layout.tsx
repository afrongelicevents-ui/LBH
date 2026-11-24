import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import { getCustomLogo } from "@/lib/sitePhotos";
import { SiteTabBar } from "@/components/ws/TabBar";
import WhatsAppButton from "@/components/WhatsAppButton";
import { showProjectsInNav } from "@/lib/projects";

/** Account settings + password (any signed-in role): the website frame. */
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const [logo, showProjects] = await Promise.all([getCustomLogo(), showProjectsInNav()]);
  return (
    <div className="ds-page flex min-h-screen flex-1 flex-col">
      <SiteHeader logo={logo} showProjects={showProjects} />
      <main className="flex-1">{children}</main>
      <SiteFooter logo={logo} />
      <SiteTabBar />
      <WhatsAppButton />
    </div>
  );
}
