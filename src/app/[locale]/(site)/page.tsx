import { setRequestLocale } from "next-intl/server";
import { getPagePhotos } from "@/lib/sitePhotos";
import { HomeHero, TrustRow, ServiceTiles, BuildAccountPreview, Process, FinalCta } from "@/components/site/home/HomeSections";

/** Homepage, about 2.5 phone screens: hero + trust row, services, Build Account, how it works, one call to action. */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const photos = await getPagePhotos();
  return (
    <>
      <HomeHero photo={photos.hero} />
      <TrustRow />
      <ServiceTiles photos={photos} />
      <BuildAccountPreview />
      <Process />
      <FinalCta />
    </>
  );
}
