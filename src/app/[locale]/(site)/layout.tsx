import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import { getCustomLogo } from "@/lib/sitePhotos";
import ChatWidget from "@/components/site/ChatWidget";
import { SiteTabBar } from "@/components/ws/TabBar";
import { showProjectsInNav } from "@/lib/projects";

/** Public website chrome — the same header, menu, tab bar and footer as the customer account. */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [logo, showProjects] = await Promise.all([getCustomLogo(), showProjectsInNav()]);
  return (
    <div className="ds-page relative flex min-h-screen flex-1 flex-col">
      <SiteHeader logo={logo} showProjects={showProjects} />
      <main className="flex-1">{children}</main>
      <SiteFooter logo={logo} />
      <SiteTabBar />
      <ChatWidget />
    </div>
  );
}
