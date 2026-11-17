import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import NotifyMeForm from "@/components/NotifyMeForm";
import Photo from "@/components/site/Photo";
import { getPagePhotos } from "@/lib/sitePhotos";
import { INTERIORS_PATH, SERVICE_GROUP_KEYS, photoKeyFor, servicePath, servicesIn } from "@/config/services";

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
  const tg = await getTranslations("site.groups");
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

      {SERVICE_GROUP_KEYS.map((g, gi) => (
        <section key={g} id={`${g}-group`} aria-labelledby={`${g}-group-title`} className={`scroll-mt-24 ${gi > 0 ? "border-t border-rule" : ""}`} data-testid={`group-${g}`}>
          <div className="ds-wrap pt-8 md:pt-12">
            <p className="font-serif text-base text-stone-ink">{String(gi + 1).padStart(2, "0")}</p>
            <h2 id={`${g}-group-title`} className="ds-h2 mt-0.5 text-[1.9rem]">{tg(`${g}.title`)}</h2>
            <p className="ds-body mt-1.5 max-w-2xl">{tg(`${g}.text`)}</p>
          </div>
          <div className="ds-wrap grid gap-x-8 gap-y-8 pt-6 pb-10 sm:grid-cols-2 md:pb-12">
            {g === "finish" ? (
              <div id="interiors" className="grid scroll-mt-24 grid-cols-[38%_1fr] gap-5 border-t border-rule pt-5">
                <Photo photo={photos.interiors} sizes="(min-width: 640px) 18vw, 38vw" className="aspect-[4/3] w-full rounded-[3px]" creditClassName="lbh-tile-credit" stockLabel={ts("stockPhoto")} />
                <div>
                  <h3 className="ds-h3">{tg("items.interiors")}</h3>
                  <p className="ds-body mt-1.5 line-clamp-3 text-[0.93rem]">{t("interiorsTeaser")}</p>
                  <Link href={INTERIORS_PATH} className="ds-link mt-2.5 inline-block text-[15px]" data-testid="interiors-link">
                    {ts("home.services.more")} <span aria-hidden>→</span>
                    <span className="sr-only"> — {tg("items.interiors")}</span>
                  </Link>
                </div>
              </div>
            ) : (
              servicesIn(g).map((s) => (
                <div key={s.key} id={s.key} className="grid scroll-mt-24 grid-cols-[38%_1fr] gap-5 border-t border-rule pt-5">
                  <Photo photo={photos[photoKeyFor(s.key)]} sizes="(min-width: 640px) 18vw, 38vw" className="aspect-[4/3] w-full rounded-[3px]" creditClassName="lbh-tile-credit" stockLabel={ts("stockPhoto")} />
                  <div>
                    <h3 id={`${s.key}-title`} className="ds-h3">{t(`${s.key}.title`)}</h3>
                    <p className="ds-body mt-1.5 line-clamp-3 text-[0.93rem]">{ts(`home.services.${s.key}.text`)}</p>
                    <Link href={servicePath(s.key)} className="ds-link mt-2.5 inline-block text-[15px]">
                      {ts("home.services.more")} <span aria-hidden>→</span>
                      <span className="sr-only"> — {t(`${s.key}.title`)}</span>
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      ))}

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
