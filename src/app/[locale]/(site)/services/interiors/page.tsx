import Image from "next/image";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getUserProfile } from "@/lib/supabase/server";
import { getInteriorGallery } from "@/lib/sitePhotos";
import DetailHero from "@/components/ws/DetailHero";
import Photo from "@/components/site/Photo";
import { PHOTOS } from "@/config/photos";
import ReplyPromise from "@/components/site/OfficeStatus";
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
  const ts = await getTranslations("site");
  const tw = await getTranslations("site.ws");
  const [{ profile }, gallery] = await Promise.all([getUserProfile(), getInteriorGallery()]);
  const signedIn = profile?.role === "client";

  return (
    <div data-testid="interiors-page">
      <DetailHero photo={PHOTOS.finish} kicker={tw("finish.kicker")} title={tw("finish.title")} backHref="/services" backLabel={tw("back")} stockLabel={ts("stockPhoto")} />
      <div className="ds-wrap pt-6 md:pt-12">
        <p className="ws-dlead max-w-3xl">{t("intro")}</p>
        <h2 className="mt-4 font-serif text-[1.35rem] font-bold text-slate">{t("title")}</h2>
        <a href="#book" className="ds-btn ds-btn-primary mt-6 w-full md:w-auto" data-testid="interiors-book-top">
          {t("cta")}
        </a>
      </div>

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

      <div className="ds-wrap">
        <div className="relative aspect-[16/9] overflow-hidden rounded-[24px] md:aspect-[21/9]">
          <Photo photo={PHOTOS.finishPhoto} sizes="(min-width: 1200px) 1200px, 100vw" className="absolute inset-0" stockLabel={ts("stockPhoto")} />
        </div>
      </div>

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
          <div className="mt-8 grid gap-3.5 md:grid-cols-3 md:gap-5" data-testid="interiors-packages">
            {PACKAGES.map((p, i) => (
              <div key={p} className={`flex flex-col rounded-[28px] border p-6 md:p-8 ${i === 2 ? "border-forest bg-paper" : "border-rule bg-paper"}`}>
                <h3 className="text-[1.6rem] font-extrabold">{t(`packages.${p}.title`)}</h3>
                <p className="mt-1 text-sm font-bold text-forest">{t("quoted")}</p>
                <p className="mt-4 text-[15px] leading-relaxed text-slate">{t(`packages.${p}.text`)}</p>
                <ul className="mt-5 mb-8 space-y-2 text-[15px]">
                  {[1, 2, 3].map((n) => (
                    <li key={n} className="flex gap-2.5">
                      <span aria-hidden className="mt-[0.7rem] h-px w-3 shrink-0 bg-forest" />
                      {t(`packages.${p}.p${n}`)}
                    </li>
                  ))}
                </ul>
                <a href="#book" className={`ds-btn mt-auto ${i === 2 ? "ds-btn-primary" : "ds-btn-outline"}`}>{t("cta")}</a>
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
            <div className="mt-5">
              <ReplyPromise />
            </div>
          </div>
          <div className="md:col-span-8">
            <InteriorsBookingForm signedIn={signedIn} />
          </div>
        </div>
      </section>
    </div>
  );
}
