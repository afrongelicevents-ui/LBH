import Header from "@/components/Header";
import { getSitePhotos } from "@/lib/sitePhotos";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";

/** Public website chrome. Portal areas (/portal, /field, /admin) use PortalShell instead. */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const photos = await getSitePhotos();
  return (
    <>
      <Header logo={photos.logo} />
      <main className="flex-1">{children}</main>
      <Footer logo={photos.logo} />
      <WhatsAppButton />
    </>
  );
}
