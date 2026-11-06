import Image from "next/image";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import SectionTitle from "@/components/SectionTitle";
import { CheckCircleIcon, ArrowRightIcon } from "@/components/icons";
import { services } from "@/lib/services";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "servicesPage" });
  return { title: t("metaTitle") };
}

function ServicesContent() {
  const t = useTranslations();

  return (
    <div className="bg-offwhite py-12 md:py-16">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <SectionTitle as="h1">{t("servicesPage.title")}</SectionTitle>
        <p className="mx-auto mt-6 max-w-3xl text-center text-base text-muted md:text-lg">
          {t("servicesPage.intro")}
        </p>

        <div className="mt-10 space-y-8 md:mt-14 md:space-y-10">
          {services.map((svc, idx) => {
            const bullets = Array.from({ length: svc.bullets }, (_, i) =>
              t(`servicesData.${svc.key}.bullet${i + 1}`)
            );
            return (
              <section
                key={svc.key}
                id={svc.key}
                className="card scroll-mt-24 md:flex"
              >
                <div
                  className={`relative aspect-3/2 md:aspect-auto md:w-2/5 ${
                    idx % 2 === 1 ? "md:order-last" : ""
                  }`}
                >
                  <Image
                    src={svc.image}
                    alt=""
                    fill
                    sizes="(min-width: 768px) 40vw, 100vw"
                    className="object-cover"
                  />
                </div>
                <div className="flex-1 p-6 md:p-8">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-xl font-bold text-forest md:text-2xl">
                      {t(`servicesData.${svc.key}.title`)}
                    </h2>
                    {svc.comingSoon && (
                      <span className="pill-soon">{t("common.comingSoon")}</span>
                    )}
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-muted md:text-base">
                    {t(`servicesData.${svc.key}.description`)}
                  </p>
                  <ul className="mt-4 space-y-2">
                    {bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2">
                        <CheckCircleIcon
                          width={18}
                          height={18}
                          className="mt-0.5 shrink-0 text-gold"
                        />
                        <span className="text-sm text-ink md:text-base">{b}</span>
                      </li>
                    ))}
                  </ul>
                  {svc.comingSoon ? (
                    <p className="mt-5 text-sm text-muted italic">
                      {t("servicesPage.notifyHint")}
                    </p>
                  ) : (
                    <Link
                      href="/book-a-call"
                      className="btn btn-gold mt-5 px-6 text-sm"
                    >
                      {t("common.bookFirstCall")}
                      <ArrowRightIcon width={18} height={18} />
                    </Link>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default async function ServicesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ServicesContent />;
}
