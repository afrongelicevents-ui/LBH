import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import Photo from "@/components/site/Photo";
import { getPagePhotos } from "@/lib/sitePhotos";
import { routing } from "@/i18n/routing";
import { SERVICES, serviceBySlug, servicePath } from "@/config/services";

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
  const photos = await getPagePhotos();
  const k = s.key;
  const others = SERVICES.filter((o) => o.key !== k);

  return (
    <article data-testid="service-page" data-service={k}>
      <header className="border-b border-rule">
        <div className="ds-wrap grid gap-6 py-8 md:grid-cols-12 md:items-center md:gap-12 md:py-14">
          <div className="md:col-span-6">
            <nav aria-label={t("breadcrumb")} className="text-sm">
              <Link href="/services" className="ds-link font-medium">{t("backAll")}</Link>
            </nav>
            <h1 className="ds-h2 mt-4 md:text-[3rem]">{t(`${k}.title`)}</h1>
            <p className="ds-lead mt-4">{t(`${k}.text`)}</p>
          </div>
          <div className="md:col-span-6">
            <Photo
              photo={photos[k]}
              sizes="(min-width: 768px) 50vw, 100vw"
              priority
              className="h-[34svh] max-h-[40svh] w-full rounded-[3px] md:aspect-[4/3] md:h-auto md:max-h-none"
              stockLabel={ts("stockPhoto")}
            />
          </div>
        </div>
      </header>

      <div className="ds-wrap grid gap-10 py-10 md:grid-cols-12 md:gap-12 md:py-14">
        <section aria-labelledby="included" className="md:col-span-6">
          <h2 id="included" className="ds-h3">{t("included")}</h2>
          <ul className="mt-4 border-t border-rule text-[15px]">
            {[1, 2, 3, 4].map((n) => (
              <li key={n} className="flex gap-3 border-b border-rule py-3 text-charcoal">
                <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="mt-0.5 shrink-0 text-forest">
                  <path d="M5 12.5l4.2 4.2L19 7" />
                </svg>
                {t(`${k}.p${n}`)}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[15px] text-charcoal">
            <span className="font-semibold">{t("youReceive")}</span> {t(`${k}.receive`)}
          </p>
        </section>

        <section aria-labelledby="how" className="md:col-span-6">
          <h2 id="how" className="ds-h3">{t("howTitle")}</h2>
          <ol className="mt-4 border-t border-rule">
            {[1, 2, 3, 4].map((n) => (
              <li key={n} className="flex gap-4 border-b border-rule py-3">
                <span className="w-5 shrink-0 font-serif text-xl leading-6 text-stone-ink">{n}</span>
                <span className="ds-body text-[15px] text-charcoal">{t(`${k}.how${n}`)}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section aria-labelledby="price" className="border-y border-rule bg-paper">
        <div className="ds-wrap flex flex-col gap-5 py-8 md:flex-row md:items-center md:justify-between md:py-10">
          <div className="max-w-2xl">
            <h2 id="price" className="ds-eyebrow">{t("priceLabel")}</h2>
            <p className="mt-2 font-serif text-[1.5rem] text-charcoal" data-testid="price-note">{t("priceValue")}</p>
            <p className="ds-body mt-1.5">{t("priceText")}</p>
          </div>
          <Link href="/book-a-call" className="ds-btn ds-btn-primary shrink-0" data-testid="service-book">
            {ts("bookConsultation")} <span aria-hidden>→</span>
          </Link>
        </div>
      </section>

      <nav aria-labelledby="others" className="ds-wrap py-10 md:py-12">
        <h2 id="others" className="ds-eyebrow">{t("others")}</h2>
        <ul className="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-3">
          {others.map((o) => (
            <li key={o.key}>
              <Link href={servicePath(o.key)} className="ds-link text-[15px]">{t(`${o.key}.title`)}</Link>
            </li>
          ))}
        </ul>
      </nav>
    </article>
  );
}
