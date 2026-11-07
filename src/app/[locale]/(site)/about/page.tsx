import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import SectionTitle from "@/components/SectionTitle";
import { CheckCircleIcon, MapPinIcon } from "@/components/icons";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "aboutPage" });
  return { title: t("metaTitle") };
}

function AboutContent() {
  const t = useTranslations();

  return (
    <div className="bg-offwhite py-12 md:py-16">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <SectionTitle as="h1">{t("aboutPage.title")}</SectionTitle>
        <p className="mt-6 text-center text-base text-muted md:text-lg">
          {t("aboutPage.intro")}
        </p>

        <div className="mt-10 space-y-6">
          <section className="card p-6">
            <h2 className="flex items-center gap-2 text-xl font-bold text-forest">
              <MapPinIcon width={22} height={22} className="text-forest" />
              {t("aboutPage.whoTitle")}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted md:text-base">
              {t("aboutPage.whoText")}
            </p>
          </section>

          <section className="card p-6">
            <h2 className="text-xl font-bold text-forest">{t("aboutPage.whyTitle")}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted md:text-base">
              {t("aboutPage.whyText")}
            </p>
          </section>

          <section className="card p-6">
            <h2 className="text-xl font-bold text-forest">
              {t("aboutPage.valuesTitle")}
            </h2>
            <ul className="mt-3 space-y-2.5">
              {(["value1", "value2", "value3", "value4"] as const).map((k) => (
                <li key={k} className="flex items-start gap-2">
                  <CheckCircleIcon
                    width={18}
                    height={18}
                    className="mt-0.5 shrink-0 text-accent"
                  />
                  <span className="text-sm text-ink md:text-base">
                    {t(`aboutPage.${k}`)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card p-6">
            <h2 className="text-xl font-bold text-forest">{t("aboutPage.teamTitle")}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted md:text-base">
              {t("aboutPage.teamText")}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AboutContent />;
}
