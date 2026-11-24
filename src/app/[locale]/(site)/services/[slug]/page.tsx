import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import DetailHero from "@/components/ws/DetailHero";
import { INCL_ICONS } from "@/components/ws/GroupPage";
import { PHOTOS } from "@/config/photos";
import { routing } from "@/i18n/routing";
import { INTERIORS_PATH, SERVICES, serviceBySlug, servicePath } from "@/config/services";

type Params = { params: Promise<{ locale: string; slug: string }> };

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => SERVICES.map((s) => ({ locale, slug: s.slug })));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const s = serviceBySlug(slug);
  if (!s) return {};
  const t = await getTranslations({ locale, namespace: "site.servicesPage" });
  return { title: t(`${s.key}.title`), description: t(`${s.key}.text`) };
}

/** One service: photo, what's included, how it works, price note, one booking button. */
export default async function ServiceDetailPage({ params }: Params) {
  const { locale, slug } = await params;
  const s = serviceBySlug(slug);
  if (!s) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("site.servicesPage");
  const ts = await getTranslations("site");
  const tg = await getTranslations("site.groups");
  const k = s.key;
  const others = SERVICES.filter((o) => o.key !== k);

  const group = s.group;
  const photo = { land: PHOTOS.land, landBuying: PHOTOS.landBuying, materials: PHOTOS.materials, onsite: PHOTOS.onsite, reporting: PHOTOS.reporting }[k];
  const n = SERVICES.findIndex((o) => o.key === k) + 1;

  return (
    <article data-testid="service-page" data-service={k}>
      <DetailHero
        photo={photo}
        kicker={`${String(n).padStart(2, "0")} · ${tg(`${group}.title`).toUpperCase()}`}
        title={t(`${k}.title`)}
        backHref={`/services/${group}`}
        backLabel={t("backAll")}
        stockLabel={ts("stockPhoto")}
        tall={false}
      />

      <div className="ds-wrap pt-6 md:pt-12">
        <p className="ws-dlead max-w-3xl">{t(`${k}.text`)}</p>
      </div>

      <div className="ds-wrap grid gap-10 py-8 md:grid-cols-12 md:gap-14 md:py-12">
        <section aria-labelledby="included" className="md:col-span-6">
          <h2 id="included" className="text-[1.5rem] font-extrabold">{t("included")}</h2>
          <ul className="ws-incl mt-4">
            {[1, 2, 3, 4].map((i) => (
              <li key={i}>
                <div className="ic">{INCL_ICONS.check}</div>
                <div className="self-center">
                  <b>{t(`${k}.p${i}`)}</b>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[15px]">
            <span className="font-bold">{t("youReceive")}</span> <span className="text-slate">{t(`${k}.receive`)}</span>
          </p>
        </section>

        <section aria-labelledby="how" className="md:col-span-6">
          <h2 id="how" className="text-[1.5rem] font-extrabold">{t("howTitle")}</h2>
          <ol className="ws-how mt-4">
            {[1, 2, 3, 4].map((i) => (
              <li key={i}>
                <span className="n">{i}</span>
                <span className="d !mt-0 self-center !text-[15px] !text-charcoal">{t(`${k}.how${i}`)}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section aria-labelledby="price" className="ds-wrap">
        <div className="flex flex-col gap-5 rounded-[28px] bg-paper p-6 md:flex-row md:items-center md:justify-between md:p-10">
          <div className="max-w-2xl">
            <h2 id="price" className="ws-kicker">{t("priceLabel")}</h2>
            <p className="mt-2 font-serif text-[1.6rem] font-extrabold tracking-[-0.02em]" data-testid="price-note">{t("priceValue")}</p>
            <p className="ds-body mt-1.5">{t("priceText")}</p>
          </div>
          <Link href={`/book-a-call?service=${k === "landBuying" ? "land" : k === "materials" ? "materials" : k === "land" ? "land" : "not-sure"}`} className="ds-btn ds-btn-primary shrink-0" data-testid="service-book">
            {ts("bookConsultation")} <span aria-hidden>→</span>
          </Link>
        </div>
      </section>

      <nav aria-labelledby="others" className="ds-wrap py-10 md:py-14">
        <h2 id="others" className="ws-kicker">{t("others")}</h2>
        <ul className="mt-3 grid gap-x-8 border-t border-rule sm:grid-cols-3">
          {others.map((o) => (
            <li key={o.key}>
              <Link href={servicePath(o.key)} className="flex min-h-12 items-center justify-between border-b border-rule font-semibold hover:text-forest">
                {t(`${o.key}.title`)} <span aria-hidden className="text-slate">→</span>
              </Link>
            </li>
          ))}
          <li>
            <Link href={INTERIORS_PATH} className="flex min-h-12 items-center justify-between border-b border-rule font-semibold hover:text-forest">
              {ts("groups.items.interiors")} <span aria-hidden className="text-slate">→</span>
            </Link>
          </li>
        </ul>
      </nav>
    </article>
  );
}
