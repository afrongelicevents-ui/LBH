import { setRequestLocale } from "next-intl/server";
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

  return (
    <>
      <Hero />
      <ProblemStrip />
      <ServicesSection />
      <HowItWorks />
      <LiveBanner />
      <TrustStrip />
      <CtaBand />
    </>
  );
}
