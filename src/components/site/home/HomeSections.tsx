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
          creditClassName="lbh-hero-credit"
          stockLabel={ts("stockPhoto")}
        />
      </div>
      <div className="ds-wrap relative py-7 md:flex md:h-full md:items-center md:py-12">
        <div className="max-w-[60%] md:max-w-[52%] lg:max-w-[50%]">
          <p className="ds-eyebrow text-[0.62rem] leading-[1.6] tracking-[0.13em] text-charcoal md:flex md:items-center md:gap-4 md:text-xs md:tracking-[0.14em]">
            <span className="md:whitespace-nowrap">{t("eyebrow")}</span>
            <span aria-hidden className="ml-2 inline-block h-px w-10 bg-stone align-middle md:ml-0 md:w-24 md:shrink-0" />
          </p>
          <h1 id="hero-title" className="lbh-hero-title mt-2.5 font-serif text-charcoal md:mt-6">
            {t("title")}
          </h1>
          <p className="mt-2.5 font-serif text-[0.98rem] leading-snug text-forest italic md:mt-5 md:text-[1.6rem]">{t("subtitle")}</p>
          <Link href="/book-a-call" className="ds-btn ds-btn-primary mt-4 min-h-[44px] px-4 py-2 text-[0.9rem] whitespace-nowrap md:mt-9 md:min-h-[48px] md:px-[1.4rem] md:py-3 md:text-[0.95rem]" data-testid="hero-cta">
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
  // camera
  process: <path d="M3.5 8.5A1.5 1.5 0 015 7h2.6l1.6-2.2h5.6L16.4 7H19a1.5 1.5 0 011.5 1.5v9A1.5 1.5 0 0119 19H5a1.5 1.5 0 01-1.5-1.5zM12 16.2a3.4 3.4 0 100-6.8 3.4 3.4 0 000 6.8z" />,
  // handshake
  photos: <path d="M2.5 9.5L6 6l3 1.5M21.5 9.5L18 6l-4.5 1.6-3.8 3.2a1.3 1.3 0 001.8 1.9l2.3-1.6 5 4.4M2.5 9.5l3.3 5.6M18.8 15.5l-1.5 1.4M5.8 15.1l1.6 1.5m0 0l1.3-1.2m-1.3 1.2l1.7 1.6 1.4-1.3m0 0l1.7 1.6 1.4-1.2m-3.1-.4l-1.6-1.5m4.7 1.9l1.5 1.3 1.8-1.6-4.2-3.8" />,
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
/* Services — four compact tiles; the detail lives on its own page.    */
/* Phones: tiles scroll sideways.                                      */
/* ------------------------------------------------------------------ */
export function ServiceTiles({ photos }: { photos: HomePhotos }) {
  const t = useTranslations("site.home.services");
  const ts = useTranslations("site");
  return (
    <section aria-labelledby="services-title" className="py-9 md:py-16" data-testid="home-services">
      <div className="ds-wrap">
        {/* phones: centred label between two hairlines; desktop: left-aligned with an "All services" link */}
        <div className="md:flex md:items-end md:justify-between md:gap-6">
          <div>
            <p className="ds-eyebrow flex items-center gap-4 text-[0.7rem] text-charcoal md:text-xs md:text-forest">
              <span aria-hidden className="h-px flex-1 bg-stone md:hidden" />
              {t("eyebrow")}
              <span aria-hidden className="h-px flex-1 bg-stone md:hidden" />
            </p>
            <h2 id="services-title" className="mt-2.5 text-center font-serif text-[1.55rem] leading-[1.15] font-medium text-charcoal md:mt-2 md:max-w-2xl md:text-left md:text-[clamp(1.75rem,4vw,2.6rem)] md:leading-[1.12] md:tracking-[-0.01em]">
              {t("title")}
            </h2>
          </div>
          <Link href="/services" className="ds-link hidden shrink-0 text-[15px] md:inline-block">{t("all")}</Link>
        </div>

        {/* phone: one compact row per service, the whole row is the link */}
        <ul className="mt-5 space-y-3 md:hidden" data-testid="service-rows">
          {SERVICES.map((s) => (
            <li key={s.key}>
              <Link href={servicePath(s.key)} className="flex items-stretch overflow-hidden rounded-[6px] border border-rule bg-paper shadow-[0_2px_10px_-4px_rgba(35,38,31,0.18)]">
                <Photo
                  photo={photos[s.key]}
                  sizes="45vw"
                  className="min-h-[84px] w-[40%] shrink-0"
                  creditClassName="lbh-tile-credit"
                  stockLabel={ts("stockPhoto")}
                />
                <span className="flex min-w-0 flex-1 items-center gap-2 py-3 pr-4 pl-3.5">
                  <span className="min-w-0 flex-1">
                    <span className="block font-serif text-[1rem] leading-tight text-charcoal min-[400px]:text-[1.06rem]">{t(`${s.key}.title`)}</span>
                    <span className="mt-1 block text-[0.8rem] leading-snug text-slate">{t(`${s.key}.short`)}</span>
                  </span>
                  <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-forest text-white">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <Link href="/services" className="ds-link mt-4 inline-block text-[15px] md:hidden">{t("all")}</Link>

        {/* desktop: four tiles in a row */}
        <ul className="mt-9 hidden grid-cols-4 gap-6 md:grid">
          {SERVICES.map((s) => (
            <li key={s.key}>
              <article className="flex h-full flex-col">
                <Photo
                  photo={photos[s.key]}
                  sizes="25vw"
                  className="aspect-[3/2] w-full rounded-[3px]"
                  creditClassName="lbh-tile-credit"
                  stockLabel={ts("stockPhoto")}
                />
                <h3 className="mt-4 font-serif text-[1.25rem] leading-tight text-charcoal">{t(`${s.key}.title`)}</h3>
                <p className="ds-body mt-1.5 flex-1 text-[0.93rem]">{t(`${s.key}.text`)}</p>
                <Link href={servicePath(s.key)} className="ds-link mt-3 inline-block text-[15px]">
                  {t("more")} <span aria-hidden>→</span>
                  <span className="sr-only"> — {t(`${s.key}.title`)}</span>
                </Link>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* How it works — 4 steps in one row; an accordion on phones           */
/* ------------------------------------------------------------------ */
export function Process() {
  const t = useTranslations("site.home.process");
  const steps = [1, 2, 3, 4] as const;
  return (
    <section aria-labelledby="process-title" className="border-y border-rule bg-paper py-12 md:py-16" data-testid="home-process">
      <div className="ds-wrap">
        <p className="ds-eyebrow">{t("eyebrow")}</p>
        <h2 id="process-title" className="ds-h2 mt-2 max-w-2xl">{t("title")}</h2>

        {/* desktop: one row */}
        <ol className="mt-9 hidden grid-cols-4 gap-8 md:grid">
          {steps.map((n) => (
            <li key={n} className="border-t border-charcoal pt-4">
              <span className="font-serif text-3xl text-stone-ink">{n}</span>
              <h3 className="mt-2 text-[1.02rem] font-semibold text-charcoal">{t(`s${n}.title`)}</h3>
              <p className="ds-body mt-1.5 text-[0.93rem]">{t(`s${n}.text`)}</p>
            </li>
          ))}
        </ol>

        {/* phone: accordion */}
        <ol className="mt-6 border-t border-rule md:hidden" data-testid="process-accordion">
          {steps.map((n) => (
            <li key={n} className="border-b border-rule">
              <details className="lbh-acc group" open={n === 1}>
                <summary className="flex min-h-[52px] cursor-pointer list-none items-center gap-4 py-3">
                  <span className="w-6 font-serif text-2xl text-stone-ink">{n}</span>
                  <span className="flex-1 text-[1rem] font-semibold text-charcoal">{t(`s${n}.title`)}</span>
                  <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 text-forest transition-transform group-open:rotate-180">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </summary>
                <p className="ds-body pb-4 pl-10">{t(`s${n}.text`)}</p>
              </details>
            </li>
          ))}
        </ol>

        <Link href="/how-it-works" className="ds-link mt-7 inline-block text-[15px]">{t("more")}</Link>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Build Account — a small preview (labelled sample data) + a link     */
/* ------------------------------------------------------------------ */
export function BuildAccountPreview() {
  const t = useTranslations("site.home.ba");
  const stages = [1, 2, 3, 4, 5].map((n) => ({ name: t(`demo.s${n}`), state: n < 3 ? "done" : n === 3 ? "now" : "next" }));
  return (
    <section aria-labelledby="ba-title" className="bg-forest py-12 text-[#e8e4d8] md:py-16" data-testid="home-ba">
      <div className="ds-wrap grid gap-8 md:grid-cols-12 md:items-center md:gap-12">
        <div className="md:col-span-6">
          <p className="ds-eyebrow text-[#c9bfa6]">{t("eyebrow")}</p>
          <h2 id="ba-title" className="ds-h2 mt-2 text-white">{t("title")}</h2>
          <p className="mt-3 max-w-lg text-[1rem] leading-relaxed text-[#d6d1c3]">{t("short")}</p>
          <Link href="/build-account" className="mt-6 inline-flex items-center gap-2 font-semibold text-white underline decoration-1 underline-offset-4 hover:decoration-2">
            {t("cta")} <span aria-hidden>→</span>
          </Link>
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
  return (
    <section aria-labelledby="cta-title" className="bg-sand py-12 md:py-16">
      <div className="ds-wrap flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <h2 id="cta-title" className="ds-h2">{t("title")}</h2>
          <p className="ds-lead mt-3">{t("text")}</p>
        </div>
        <Link href="/book-a-call" className="ds-btn ds-btn-primary shrink-0" data-testid="final-cta">
          {t("button")}
        </Link>
      </div>
    </section>
  );
}
