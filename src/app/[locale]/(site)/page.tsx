import { setRequestLocale } from "next-intl/server";
import { getPagePhotos } from "@/lib/sitePhotos";
import { HomeHero, TrustRow, ServicesEditorial, BuildAccountShowcase, Process, WhyLbh, FinalCta } from "@/components/site/home/HomeSections";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const photos = await getPagePhotos();
  return (
    <>
      <HomeHero photo={photos.hero} />
      <TrustRow />
      <ServicesEditorial photos={photos} />
      <BuildAccountShowcase />
      <Process />
      <WhyLbh />
      <FinalCta />
    </>
  );
}
