import Image from "next/image";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getUserProfile } from "@/lib/supabase/server";
import { getInteriorGallery, getPagePhotos } from "@/lib/sitePhotos";
import Photo from "@/components/site/Photo";
import InteriorsBookingForm from "@/components/site/InteriorsBookingForm";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "site.interiors" });
  return { title: t("metaTitle"), description: t("intro") };
}

const WHAT = ["design", "threeD", "furniture", "appliances", "finishes", "buy", "furnish"] as const;
const STEPS = [1, 2, 3, 4, 5, 6] as const;
const PACKAGES = ["consultation", "design3d", "full"] as const;

/** Interiors & Furnishing — the "Finish" service. */
export default async function InteriorsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("site.interiors");
  const tg = await getTranslations("site.groups");
  const ts = await getTranslations("site");
  const [{ profile }, photos, gallery] = await Promise.all([getUserProfile(), getPagePhotos(), getInteriorGallery()]);
  const signedIn = profile?.role === "client";

  return (
    <div data-testid="interiors-page">
      {/* intro */}
      <header className="border-b border-rule">
        <div className="ds-wrap grid gap-10 py-14 md:grid-cols-12 md:items-end md:py-20">
          <div className="md:col-span-6">
            <p className="ds-eyebrow">
              {ts("nav.services")} · {tg("finish.title")}
            </p>
            <h1 className="ds-h2 mt-3 md:text-[3rem]">{t("title")}</h1>
            <p className="ds-lead mt-5">{t("intro")}</p>
            <a href="#book" className="ds-btn ds-btn-primary mt-8" data-testid="interiors-book-top">
              {t("cta")}
            </a>
          </div>
          <div className="md:col-span-6">
            <Photo photo={photos.interiors} sizes="(min-width: 768px) 50vw, 100vw" priority className="aspect-[4/3] w-full rounded-[3px]" stockLabel={ts("stockPhoto")} />
          </div>
        </div>
      </header>

      {/* what we do */}
      <section aria-labelledby="what" className="py-14 md:py-20">
        <div className="ds-wrap grid gap-8 md:grid-cols-12">
          <div className="md:col-span-4">
            <h2 id="what" className="ds-h2">{t("whatTitle")}</h2>
            <p className="ds-body mt-3">{t("whatIntro")}</p>
          </div>
          <ul className="grid gap-x-10 md:col-span-7 md:col-start-6 md:grid-cols-2">
            {WHAT.map((k) => (
              <li key={k} className="border-t border-rule py-4">
                <span className="block font-serif text-[1.15rem] text-charcoal">{t(`what.${k}.title`)}</span>
                <span className="ds-body mt-1 block text-sm">{t(`what.${k}.text`)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* how it works */}
      <section aria-labelledby="how" className="border-y border-rule bg-paper py-14 md:py-20">
        <div className="ds-wrap">
          <h2 id="how" className="ds-h2">{t("howTitle")}</h2>
          <ol className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {STEPS.map((n) => (
              <li key={n} className="border-t border-charcoal pt-5">
                <span className="font-serif text-4xl text-stone-ink">{n}</span>
                <h3 className="mt-3 text-lg font-semibold text-charcoal">{t(`steps.s${n}.title`)}</h3>
                <p className="ds-body mt-2">{t(`steps.s${n}.text`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* packages */}
      <section aria-labelledby="packages" className="py-14 md:py-20">
        <div className="ds-wrap">
          <div className="max-w-2xl">
            <h2 id="packages" className="ds-h2">{t("packagesTitle")}</h2>
            <p className="ds-body mt-3">{t("packagesIntro")}</p>
          </div>
          <div className="mt-10 grid gap-px border border-rule bg-rule md:grid-cols-3" data-testid="interiors-packages">
            {PACKAGES.map((p, i) => (
              <div key={p} className={`flex flex-col p-6 md:p-8 ${i === 2 ? "bg-forest text-[#e8e4d8]" : "bg-paper"}`}>
                <h3 className={`font-serif text-2xl ${i === 2 ? "text-white" : "text-charcoal"}`}>{t(`packages.${p}.title`)}</h3>
                <p className={`mt-1 text-sm font-semibold ${i === 2 ? "text-[#c9bfa6]" : "text-stone-ink"}`}>{t("quoted")}</p>
                <p className={`mt-4 text-[15px] leading-relaxed ${i === 2 ? "text-[#d6d1c3]" : "text-slate"}`}>{t(`packages.${p}.text`)}</p>
                <ul className="mt-5 mb-8 space-y-2 text-[15px]">
                  {[1, 2, 3].map((n) => (
                    <li key={n} className="flex gap-2.5">
                      <span aria-hidden className={`mt-[0.7rem] h-px w-3 shrink-0 ${i === 2 ? "bg-[#c9bfa6]" : "bg-forest"}`} />
                      {t(`packages.${p}.p${n}`)}
                    </li>
                  ))}
                </ul>
                <a href="#book" className={`ds-btn mt-auto ${i === 2 ? "ds-btn-light" : "ds-btn-outline"}`}>{t("cta")}</a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* before / after */}
      <section aria-labelledby="gallery" className="border-y border-rule bg-paper py-14 md:py-20" data-testid="interiors-gallery">
        <div className="ds-wrap">
          <h2 id="gallery" className="ds-h2">{t("galleryTitle")}</h2>
          <p className="ds-body mt-3 max-w-2xl">{t("galleryIntro")}</p>
          <ul className="mt-10 grid gap-10 md:grid-cols-3">
            {gallery.map((g) => (
              <li key={g.n}>
                <div className="grid grid-cols-2 gap-2">
                  {(["before", "after"] as const).map((side) => (
                    <figure key={side}>
                      <span className="relative block aspect-[4/5] overflow-hidden bg-sand">
                        {g[side] ? (
                          <Image src={g[side]!} alt={t(side === "before" ? "beforeAlt" : "afterAlt", { n: g.n })} fill sizes="(min-width: 768px) 16vw, 50vw" className="object-cover" />
                        ) : (
                          <span className="flex h-full items-center justify-center p-3 text-center text-xs text-slate" data-testid="gallery-placeholder">
                            {t("photoSoon")}
                          </span>
                        )}
                      </span>
                      <figcaption className="mt-1.5 text-xs font-semibold tracking-wider text-slate uppercase">{t(side)}</figcaption>
                    </figure>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* book */}
      <section id="book" aria-labelledby="book-title" className="scroll-mt-24 py-14 md:py-20">
        <div className="ds-wrap grid gap-10 md:grid-cols-12">
          <div className="md:col-span-4">
            <h2 id="book-title" className="ds-h2">{t("bookTitle")}</h2>
            <p className="ds-body mt-3">{signedIn ? t("bookIntroSignedIn") : t("bookIntro")}</p>
          </div>
          <div className="md:col-span-8">
            <InteriorsBookingForm signedIn={signedIn} />
          </div>
        </div>
      </section>
    </div>
  );
}
