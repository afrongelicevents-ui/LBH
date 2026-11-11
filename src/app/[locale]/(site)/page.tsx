import { setRequestLocale } from "next-intl/server";
import { getPagePhotos } from "@/lib/sitePhotos";
import { HomeHero, TrustRow, ServiceTiles, Process, BuildAccountPreview, FinalCta } from "@/components/site/home/HomeSections";

/** Homepage: five short sections — hero (with trust row), services, how it works, Build Account, call to action. */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const photos = await getPagePhotos();
  return (
    <>
      <HomeHero photo={photos.hero} />
      <TrustRow />
      <ServiceTiles photos={photos} />
      <Process />
      <BuildAccountPreview />
      <FinalCta />
    </>
  );
}
