import { setRequestLocale } from "next-intl/server";
import { getPagePhotos } from "@/lib/sitePhotos";
import { HomeHero, TrustRow, ServiceTiles, Process, FinalCta } from "@/components/site/home/HomeSections";

/** Homepage, about three phone screens: hero + trust row, services, how it works, one call to action. */
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
      <FinalCta />
    </>
  );
}
