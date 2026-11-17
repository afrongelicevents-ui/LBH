import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import NotifyMeForm from "@/components/NotifyMeForm";
import Photo, { type PhotoSource } from "@/components/site/Photo";
import { getPagePhotos } from "@/lib/sitePhotos";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "site.servicesPage" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

type ServiceKey = "land" | "landBuying" | "materials" | "onsite" | "reporting";
const GROUPS: { key: "land" | "build"; services: { key: ServiceKey; id: string }[] }[] = [
  { key: "land", services: [{ key: "land", id: "land" }, { key: "landBuying", id: "land-buying" }] },
  { key: "build", services: [{ key: "materials", id: "materials" }, { key: "onsite", id: "onsite" }, { key: "reporting", id: "reporting" }] },
];

/** Our services — grouped as a build happens: Land · Build · Finish (+ a quiet "coming soon" note). */
export default async function ServicesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("site.servicesPage");
  const tg = await getTranslations("site.groups");
  const ts = await getTranslations("site");
  const photos = await getPagePhotos();
  const photoOf: Partial<Record<ServiceKey, PhotoSource>> = { land: photos.land, materials: photos.materials, onsite: photos.onsite, reporting: photos.reporting };
  let n = 0;

  return (
    <div data-testid="services-page">
      <header className="border-b border-rule">
        <div className="ds-wrap py-14 md:py-20">
          <p className="ds-eyebrow">{ts("nav.services")}</p>
          <h1 className="ds-h2 mt-3 max-w-3xl md:text-[3.2rem]">{t("title")}</h1>
          <p className="ds-lead mt-5 max-w-2xl">{t("intro")}</p>
          <nav aria-label={t("jump")} className="mt-8 grid gap-4 sm:grid-cols-3">
            {(["land", "build", "finish"] as const).map((g, i) => (
              <a key={g} href={g === "finish" ? "#finish" : `#${g}-group`} className="group border-t border-charcoal pt-3">
                <span className="font-serif text-lg text-stone-ink">{String(i + 1).padStart(2, "0")}</span>{" "}
                <span className="font-serif text-xl text-charcoal group-hover:text-forest">{tg(`${g}.title`)}</span>
                <span className="mt-1 block text-sm text-slate">{tg(`${g}.short`)}</span>
              </a>
            ))}
          </nav>
        </div>
      </header>

      {GROUPS.map((g) => (
        <div key={g.key} id={`${g.key}-group`} className="scroll-mt-24">
          <div className="border-b border-rule bg-sand/60">
            <div className="ds-wrap flex flex-wrap items-baseline gap-x-4 gap-y-1 py-6" id={g.key === "build" ? "build" : undefined}>
              <h2 className="ds-h2 text-[1.9rem]">{tg(`${g.key}.title`)}</h2>
              <p className="ds-body">{tg(`${g.key}.text`)}</p>
            </div>
          </div>
          {g.services.map((s) => {
            n += 1;
            const photo = photoOf[s.key];
            const flip = n % 2 === 0;
            return (
              <section key={s.key} id={s.id} aria-labelledby={`${s.id}-title`} className={`scroll-mt-24 border-b border-rule py-14 md:py-20 ${flip ? "bg-paper" : ""}`}>
                <div className="ds-wrap grid gap-8 md:grid-cols-12 md:gap-12">
                  {photo && (
                    <div className={`md:col-span-6 ${flip ? "md:order-2" : ""}`}>
                      <Photo photo={photo} sizes="(min-width: 768px) 50vw, 100vw" className="aspect-[4/3] w-full rounded-[3px]" stockLabel={ts("stockPhoto")} />
                    </div>
                  )}
                  <div className={photo ? "md:col-span-6" : "md:col-span-8"}>
                    <p className="font-serif text-lg text-stone-ink">{String(n).padStart(2, "0")}</p>
                    <h3 id={`${s.id}-title`} className="ds-h2 mt-1 text-[2rem]">{t(`${s.key}.title`)}</h3>
                    <p className="ds-body mt-4 text-base">{t(`${s.key}.text`)}</p>
                    <h4 className="mt-7 text-sm font-semibold tracking-wider text-charcoal uppercase">{t("whatWeDo")}</h4>
                    <ul className="mt-3 border-t border-rule text-[15px]">
                      {[1, 2, 3, 4].map((p) => (
                        <li key={p} className="flex gap-3 border-b border-rule py-2.5 text-charcoal">
                          <span aria-hidden className="mt-[0.7rem] h-px w-3 shrink-0 bg-forest" />
                          {t(`${s.key}.p${p}`)}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-5 text-[15px] text-charcoal">
                      <span className="font-semibold">{t("youReceive")}</span> {t(`${s.key}.receive`)}
                    </p>
                    <Link href="/book-a-call" className="ds-btn ds-btn-primary mt-7">
                      {ts("bookConsultation")}
                    </Link>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      ))}

      {/* Finish — its own page */}
      <section id="finish" aria-labelledby="finish-title" className="scroll-mt-24 border-b border-rule">
        <div className="border-b border-rule bg-sand/60">
          <div className="ds-wrap flex flex-wrap items-baseline gap-x-4 gap-y-1 py-6">
            <h2 id="finish-title" className="ds-h2 text-[1.9rem]">{tg("finish.title")}</h2>
            <p className="ds-body">{tg("finish.text")}</p>
          </div>
        </div>
        <div className="ds-wrap grid gap-8 py-14 md:grid-cols-12 md:gap-12 md:py-20">
          <div className="md:col-span-6">
            <Photo photo={photos.interiors} sizes="(min-width: 768px) 50vw, 100vw" className="aspect-[4/3] w-full rounded-[3px]" stockLabel={ts("stockPhoto")} />
          </div>
          <div className="md:col-span-6">
            <p className="font-serif text-lg text-stone-ink">{String(n + 1).padStart(2, "0")}</p>
            <h3 className="ds-h2 mt-1 text-[2rem]">{tg("items.interiors")}</h3>
            <p className="ds-body mt-4 text-base">{t("interiorsTeaser")}</p>
            <Link href="/services/interiors" className="ds-btn ds-btn-primary mt-7" data-testid="interiors-link">
              {tg("finish.more")}
            </Link>
          </div>
        </div>
      </section>

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
