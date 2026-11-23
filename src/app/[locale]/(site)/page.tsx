import { setRequestLocale } from "next-intl/server";
import { HomeHero, Pillars, StoryPocket, WhatWeDo, MoneySafe, LiveBand, Closing } from "@/components/site/home/HomeSections";

/** Home (Warm Sand): photo hero, Land · Build · Finish, sample Build Account, services, how money stays safe, sample live camera, closing call to action. */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <HomeHero />
      <Pillars />
      <StoryPocket />
      <WhatWeDo />
      <MoneySafe />
      <LiveBand />
      <Closing />
    </>
  );
}
