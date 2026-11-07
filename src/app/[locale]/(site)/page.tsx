import { setRequestLocale } from "next-intl/server";
import { getSitePhotos } from "@/lib/sitePhotos";
import Hero from "@/components/home/Hero";
import ProblemStrip from "@/components/home/ProblemStrip";
import ServicesSection from "@/components/home/ServicesSection";
import HowItWorks from "@/components/home/HowItWorks";
import LiveBanner from "@/components/home/LiveBanner";
import TrustStrip from "@/components/home/TrustStrip";
import CtaBand from "@/components/home/CtaBand";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const photos = await getSitePhotos();

  return (
    <>
      <Hero photo={photos.hero} />
      <ProblemStrip />
      <ServicesSection photos={photos} />
      <HowItWorks />
      <LiveBanner photo={photos.live_feed} logo={photos.logo} />
      <TrustStrip />
      <CtaBand />
    </>
  );
}
