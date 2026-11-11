import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import Photo, { type PhotoSource } from "@/components/site/Photo";
import { formatCents } from "@/lib/money";
import { SERVICES, servicePath } from "@/config/services";

/** Illustration only — clearly labelled "Sample data" on the page. */
const SAMPLE = { budget: 4200000, spent: 1845000 };

export type HomePhotos = Record<"hero" | "land" | "materials" | "onsite" | "reporting", PhotoSource>;

/* ------------------------------------------------------------------ */
/* Hero — text on ivory at left, photo on the right fading into it.   */
/* Desktop: hero + trust row fill exactly one screen under the header. */
/* Phone: a short photo (≤40% of the screen) that fades into ivory,    */
/* with the headline and button sliding up over the faded part.        */
/* ------------------------------------------------------------------ */
export function HomeHero({ photo }: { photo: PhotoSource }) {
  const t = useTranslations("site.home.hero");
  const ts = useTranslations("site");
  return (
    <section className="lbh-hero relative isolate overflow-hidden bg-ivory" aria-labelledby="hero-title" data-testid="home-hero">
      {/* the photo sits on the right on every screen and fades into the ivory behind the text */}
      <div className="lbh-hero-photo absolute inset-y-0 right-0 w-[64%] md:w-[62%]">
        <Photo
          photo={photo}
          sizes="(min-width: 768px) 62vw, 64vw"
          priority
          className="h-full w-full"
          hideCredit
          stockLabel={ts("stockPhoto")}
        />
      </div>
      <div className="ds-wrap relative py-9 md:flex md:h-full md:items-center md:py-12">
        <div className="max-w-[60%] md:max-w-[52%] lg:max-w-[50%]">
          <h1 id="hero-title" className="lbh-hero-title font-serif text-charcoal">
            {t("title")}
          </h1>
          <p className="mt-3 font-serif text-[1.02rem] leading-snug text-forest italic md:mt-5 md:text-[1.6rem]">{t("subtitle")}</p>
          <Link href="/book-a-call" className="ds-btn ds-btn-primary mt-5 min-h-[44px] px-4 py-2 text-[0.9rem] whitespace-nowrap md:mt-9 md:min-h-[48px] md:px-[1.4rem] md:py-3 md:text-[0.95rem]" data-testid="hero-cta">
            {t("cta")}
            <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Trust indicators — thin outline icons, hairline dividers           */
/* ------------------------------------------------------------------ */
const TRUST_ICONS: Record<string, React.ReactNode> = {
  // shield with a tick
  verified: <path d="M12 3l7.5 2.8v5.7c0 4.6-3.1 8.3-7.5 9.9-4.4-1.6-7.5-5.3-7.5-9.9V5.8L12 3zM8.6 12.1l2.4 2.4 4.5-4.7" />,
  // clipboard with lines (written quotes, nothing hidden)
  process: <path d="M9 4.5h6M9 4.5a1.5 1.5 0 011.5-1.5h3A1.5 1.5 0 0115 4.5M9 4.5H6.5A1.5 1.5 0 005 6v13.5A1.5 1.5 0 006.5 21h11a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H15M8.5 10.5h7M8.5 14h7M8.5 17.5h4" />,
  // camera
  photos: <path d="M3.5 8.5A1.5 1.5 0 015 7h2.6l1.6-2.2h5.6L16.4 7H19a1.5 1.5 0 011.5 1.5v9A1.5 1.5 0 0119 19H5a1.5 1.5 0 01-1.5-1.5zM12 16.2a3.4 3.4 0 100-6.8 3.4 3.4 0 000 6.8z" />,
  // headset
  support: <path d="M4.5 13.5V12a7.5 7.5 0 0115 0v1.5M4.5 13.5h2.8v5H6a1.5 1.5 0 01-1.5-1.5zM19.5 13.5h-2.8v5H18a1.5 1.5 0 001.5-1.5zM16.7 18.5c0 1.4-1.6 2.3-3.7 2.3" />,
};
export function TrustRow() {
  const t = useTranslations("site.home.trust");
  const keys = ["verified", "process", "photos", "support"] as const;
  return (
    <section aria-label={t("label")} className="lbh-trust border-y border-rule bg-[#ece5d7] md:bg-paper" data-testid="home-trust">
      <ul className="ds-wrap grid grid-cols-4 px-2 md:px-8">
        {keys.map((k) => (
          <li key={k} className="lbh-trust-item flex flex-col items-center justify-center gap-1 py-3 text-center md:flex-row md:gap-4 md:py-0 md:text-left">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-6 w-6 shrink-0 text-forest md:h-10 md:w-10">
              {TRUST_ICONS[k]}
            </svg>
            <span className="lbh-trust-label font-serif text-[0.7rem] leading-[1.25] text-charcoal min-[400px]:text-[0.76rem] md:max-w-[9rem] md:text-[1.15rem] md:leading-snug">
              {t(`${k}.title`)}
              <span className="sr-only">: {t(`${k}.text`)}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Services — 2×2 tiles on phones (4 in a row on desktop): photo +     */
/* title, each opening that service's own page.                        */
/* ------------------------------------------------------------------ */
export function ServiceTiles({ photos }: { photos: HomePhotos }) {
  const t = useTranslations("site.home.services");
  const ts = useTranslations("site");
  return (
    <section aria-labelledby="services-title" className="py-9 md:py-14" data-testid="home-services">
      <div className="ds-wrap">
        <h2 id="services-title" className="ds-eyebrow flex items-center gap-4 text-[0.72rem] text-charcoal md:text-xs">
          <span aria-hidden className="h-px flex-1 bg-stone md:hidden" />
          {t("eyebrow")}
          <span aria-hidden className="h-px flex-1 bg-stone" />
        </h2>
        <ul className="mt-5 grid grid-cols-2 gap-x-3 gap-y-4 md:mt-7 md:grid-cols-4 md:gap-6" data-testid="service-tiles">
          {SERVICES.map((s) => (
            <li key={s.key}>
              <Link href={servicePath(s.key)} className="group block" data-testid={`tile-${s.key}`}>
                <Photo
                  photo={photos[s.key]}
                  sizes="(min-width: 768px) 25vw, 50vw"
                  className="aspect-[4/3] w-full rounded-[4px]"
                  hideCredit
                  stockLabel={ts("stockPhoto")}
                />
                <span className="mt-2 flex items-start justify-between gap-2 font-serif text-[1rem] leading-tight text-charcoal group-hover:text-forest md:mt-3 md:text-[1.2rem]">
                  {t(`${s.key}.title`)}
                  <span aria-hidden className="text-forest">→</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* How it works — one compact strip of 4 numbered steps                */
/* ------------------------------------------------------------------ */
export function Process() {
  const t = useTranslations("site.home.process");
  return (
    <section aria-labelledby="process-title" className="border-y border-rule bg-paper py-7 md:py-11" data-testid="home-process">
      <div className="ds-wrap">
        <h2 id="process-title" className="ds-eyebrow flex items-center gap-4 text-[0.72rem] text-charcoal md:text-xs">
          <span aria-hidden className="h-px flex-1 bg-stone md:hidden" />
          {t("eyebrow")}
          <span aria-hidden className="h-px flex-1 bg-stone" />
        </h2>
        <ol className="mt-5 grid grid-cols-4 gap-2 md:mt-7 md:gap-8">
          {[1, 2, 3, 4].map((n) => (
            <li key={n} className="border-t border-charcoal/70 pt-2.5 md:pt-4">
              <span className="block font-serif text-[1.6rem] leading-none text-stone-ink md:text-3xl">{n}</span>
              <span className="mt-1.5 block text-[0.78rem] leading-snug font-semibold text-charcoal min-[400px]:text-[0.84rem] md:text-[1rem]">{t(`s${n}.short`)}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Build Account — a small preview (labelled sample data) + a link     */
/* ------------------------------------------------------------------ */
export function BuildAccountPreview({ showLink = true }: { showLink?: boolean }) {
  const t = useTranslations("site.home.ba");
  const stages = [1, 2, 3, 4, 5].map((n) => ({ name: t(`demo.s${n}`), state: n < 3 ? "done" : n === 3 ? "now" : "next" }));
  return (
    <section aria-labelledby="ba-title" className="bg-forest py-12 text-[#e8e4d8] md:py-16" data-testid="home-ba">
      <div className="ds-wrap grid gap-8 md:grid-cols-12 md:items-center md:gap-12">
        <div className="md:col-span-6">
          <p className="ds-eyebrow text-[#c9bfa6]">{t("eyebrow")}</p>
          <h2 id="ba-title" className="ds-h2 mt-2 text-white">{t("title")}</h2>
          <p className="mt-3 max-w-lg text-[1rem] leading-relaxed text-[#d6d1c3]">{t("short")}</p>
          {showLink && (
            <Link href="/build-account" className="mt-6 inline-flex items-center gap-2 font-semibold text-white underline decoration-1 underline-offset-4 hover:decoration-2">
              {t("cta")} <span aria-hidden>→</span>
            </Link>
          )}
        </div>

        <div className="md:col-span-6" aria-label={t("demo.label")}>
          <div className="overflow-hidden rounded-[6px] bg-paper text-charcoal shadow-[0_24px_48px_-24px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between border-b border-rule px-5 py-3">
              <span className="font-serif text-[1.02rem] text-forest">{t("demo.title")}</span>
              <span className="ds-tag ds-tag-alert" data-testid="sample-tag">{t("demo.sample")}</span>
            </div>
            <div className="grid grid-cols-3 divide-x divide-rule border-b border-rule">
              {(["budget", "spent", "left"] as const).map((k) => (
                <div key={k} className="px-4 py-3 sm:px-5">
                  <p className="text-[11px] font-semibold tracking-wider text-slate uppercase">{t(`demo.${k}`)}</p>
                  <p className="mt-1 font-serif text-lg sm:text-xl">
                    {formatCents(k === "budget" ? SAMPLE.budget : k === "spent" ? SAMPLE.spent : SAMPLE.budget - SAMPLE.spent).replace(".00", "")}
                  </p>
                </div>
              ))}
            </div>
            <div className="px-5 py-3.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">{t("demo.progress")}</span>
                <span className="text-slate">{t("demo.progressValue")}</span>
              </div>
              <ol className="mt-2.5 grid grid-cols-5 gap-1.5">
                {stages.map((s) => (
                  <li key={s.name}>
                    <span className={`block h-1.5 rounded-full ${s.state === "done" ? "bg-forest" : s.state === "now" ? "bg-stone" : "bg-sand"}`} />
                    <span className={`mt-1.5 truncate text-[11px] ${s.state === "now" ? "block font-semibold whitespace-nowrap text-charcoal" : "hidden text-slate sm:block"}`}>{s.name}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
          <p className="mt-2.5 text-xs text-[#c9c3b3]">{t("demo.note")}</p>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Final call to action                                                */
/* ------------------------------------------------------------------ */
export function FinalCta() {
  const t = useTranslations("site.home.cta");
  const th = useTranslations("site.home.hero");
  return (
    <section aria-labelledby="cta-title" className="bg-sand py-10 md:py-14">
      <div className="ds-wrap flex flex-col items-start gap-5 md:flex-row md:items-center md:justify-between">
        <h2 id="cta-title" className="ds-h2 max-w-xl">{t("title")}</h2>
        <Link href="/book-a-call" className="ds-btn ds-btn-primary shrink-0" data-testid="final-cta">
          {th("cta")} <span aria-hidden>→</span>
        </Link>
      </div>
    </section>
  );
}
