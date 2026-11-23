import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SampleBar, SampleLive } from "@/components/ws/SampleScreens";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "site" });
  return { title: t("sampleLive"), robots: { index: false } };
}

/** SAMPLE live camera (the camera service is coming soon): what clients will see. */
export default async function SampleLivePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("site.ws");
  return (
    <div className="ds-wrap pt-6 pb-14 md:pt-12" data-testid="sample-live-page">
      <div className="flex items-end justify-between gap-3">
        <h1 className="font-serif text-[2.25rem] leading-[0.95] font-extrabold tracking-[-0.035em] md:text-[3.25rem]">{t("liveTitlePage")}</h1>
        <span className="ws-tag" data-testid="sample-tag">{t("sample")}</span>
      </div>
      <div className="mt-4 mb-5">
        <SampleBar text={t("sampleLiveText")} />
      </div>
      <SampleLive />
    </div>
  );
}
