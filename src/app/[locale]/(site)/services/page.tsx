import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import NotifyMeForm from "@/components/NotifyMeForm";
import Photo from "@/components/site/Photo";
import { getPagePhotos } from "@/lib/sitePhotos";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "site.servicesPage" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

const SERVICES = ["land", "materials", "onsite", "reporting"] as const;

/** Our services — four services LBH delivers today, plus a quiet "coming soon" note. */
export default async function ServicesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("site.servicesPage");
  const ts = await getTranslations("site");
  const photos = await getPagePhotos();

  return (
    <div data-testid="services-page">
      <header className="border-b border-rule">
        <div className="ds-wrap py-14 md:py-20">
          <p className="ds-eyebrow">{ts("nav.services")}</p>
          <h1 className="ds-h2 mt-3 max-w-3xl md:text-[3.2rem]">{t("title")}</h1>
          <p className="ds-lead mt-5 max-w-2xl">{t("intro")}</p>
          <nav aria-label={t("jump")} className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[15px]">
            {SERVICES.map((k, i) => (
              <a key={k} href={`#${k}`} className="ds-link">
                {String(i + 1).padStart(2, "0")} · {t(`${k}.title`)}
              </a>
            ))}
          </nav>
        </div>
      </header>

      {SERVICES.map((k, i) => (
        <section key={k} id={k} aria-labelledby={`${k}-title`} className={`scroll-mt-24 border-b border-rule py-14 md:py-20 ${i % 2 ? "bg-paper" : ""}`}>
          <div className="ds-wrap grid gap-8 md:grid-cols-12 md:gap-12">
            <div className={`md:col-span-6 ${i % 2 ? "md:order-2" : ""}`}>
              <Photo photo={photos[k]} sizes="(min-width: 768px) 50vw, 100vw" className="aspect-[4/3] w-full rounded-[3px]" stockLabel={ts("stockPhoto")} />
            </div>
            <div className="md:col-span-6">
              <p className="font-serif text-lg text-stone-ink">{String(i + 1).padStart(2, "0")}</p>
              <h2 id={`${k}-title`} className="ds-h2 mt-1 text-[2rem]">{t(`${k}.title`)}</h2>
              <p className="ds-body mt-4 text-base">{t(`${k}.text`)}</p>
              <h3 className="mt-7 text-sm font-semibold tracking-wider text-charcoal uppercase">{t("whatWeDo")}</h3>
              <ul className="mt-3 border-t border-rule text-[15px]">
                {[1, 2, 3, 4].map((n) => (
                  <li key={n} className="flex gap-3 border-b border-rule py-2.5 text-charcoal">
                    <span aria-hidden className="mt-[0.7rem] h-px w-3 shrink-0 bg-forest" />
                    {t(`${k}.p${n}`)}
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-[15px] text-charcoal">
                <span className="font-semibold">{t("youReceive")}</span> {t(`${k}.receive`)}
              </p>
              <Link href="/book-a-call" className="ds-btn ds-btn-primary mt-7">
                {ts("bookConsultation")}
              </Link>
            </div>
          </div>
        </section>
      ))}

      <section id="camera" aria-labelledby="soon" className="scroll-mt-24 py-12 md:py-14">
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
