import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import NotifyMeForm from "@/components/NotifyMeForm";
import Photo from "@/components/site/Photo";
import { getPagePhotos } from "@/lib/sitePhotos";
import { SERVICES, servicePath } from "@/config/services";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "site.servicesPage" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

/** Our services — a short overview; each service has its own page with the details. */
export default async function ServicesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("site.servicesPage");
  const ts = await getTranslations("site");
  const photos = await getPagePhotos();

  return (
    <div data-testid="services-page">
      <header className="border-b border-rule">
        <div className="ds-wrap py-10 md:py-14">
          <p className="ds-eyebrow">{ts("nav.services")}</p>
          <h1 className="ds-h2 mt-3 max-w-3xl md:text-[3rem]">{t("title")}</h1>
          <p className="ds-lead mt-4 max-w-2xl">{t("intro")}</p>
        </div>
      </header>

      <div className="ds-wrap grid gap-x-8 gap-y-10 py-10 sm:grid-cols-2 md:py-14">
        {SERVICES.map((s, i) => (
          <section key={s.key} id={s.key} aria-labelledby={`${s.key}-title`} className="grid scroll-mt-24 grid-cols-[38%_1fr] gap-5 border-t border-rule pt-5">
            <Photo photo={photos[s.key]} sizes="(min-width: 640px) 18vw, 38vw" className="aspect-[4/3] w-full rounded-[3px]" creditClassName="lbh-tile-credit" stockLabel={ts("stockPhoto")} />
            <div>
              <p className="font-serif text-base text-stone-ink">{String(i + 1).padStart(2, "0")}</p>
              <h2 id={`${s.key}-title`} className="ds-h3 mt-0.5">{t(`${s.key}.title`)}</h2>
              <p className="ds-body mt-1.5 line-clamp-3 text-[0.93rem]">{ts(`home.services.${s.key}.text`)}</p>
              <Link href={servicePath(s.key)} className="ds-link mt-2.5 inline-block text-[15px]">
                {ts("home.services.more")} <span aria-hidden>→</span>
                <span className="sr-only"> — {t(`${s.key}.title`)}</span>
              </Link>
            </div>
          </section>
        ))}
      </div>

      <section id="camera" aria-labelledby="soon" className="scroll-mt-24 border-t border-rule bg-paper py-10 md:py-12">
        <div className="ds-wrap grid gap-6 md:grid-cols-12 md:items-end">
          <div className="md:col-span-7">
            <span className="ds-tag">{ts("home.services.soonTag")}</span>
            <h2 id="soon" className="ds-h3 mt-3">{t("camera.title")}</h2>
            <p className="ds-body mt-2">{t("camera.text")}</p>
          </div>
          <div className="md:col-span-5">
            <NotifyMeForm service="camera" />
          </div>
        </div>
      </section>
    </div>
  );
}
