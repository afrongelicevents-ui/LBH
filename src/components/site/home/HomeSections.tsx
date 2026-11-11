import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import Photo, { type PhotoSource } from "@/components/site/Photo";
import { formatCents } from "@/lib/money";

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
      <div className="lbh-hero-photo relative h-[40svh] max-h-[400px] min-h-[220px] md:absolute md:inset-y-0 md:right-0 md:h-auto md:max-h-none md:min-h-0 md:w-[62%]">
        <Photo
          photo={photo}
          sizes="(min-width: 768px) 62vw, 100vw"
          priority
          className="h-full w-full"
          creditClassName="lbh-hero-credit"
          stockLabel={ts("stockPhoto")}
        />
      </div>
      <div className="ds-wrap relative -mt-14 pb-8 md:mt-0 md:flex md:h-full md:items-center md:py-12">
        <div className="md:max-w-[52%] lg:max-w-[50%]">
          <p className="ds-eyebrow flex items-center gap-3 text-[0.68rem] tracking-[0.12em] text-charcoal md:gap-4 md:text-xs md:tracking-[0.14em]">
            <span className="whitespace-nowrap">{t("eyebrow")}</span>
            <span aria-hidden className="h-px w-10 shrink-0 bg-stone md:w-24" />
          </p>
          <h1 id="hero-title" className="lbh-hero-title mt-4 font-serif text-charcoal md:mt-6">
            {t("title")}
          </h1>
          <p className="mt-3 font-serif text-[1.2rem] leading-snug text-forest italic md:mt-5 md:text-[1.6rem]">{t("subtitle")}</p>
          <Link href="/book-a-call" className="ds-btn ds-btn-primary mt-6 md:mt-9" data-testid="hero-cta">
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
    <section aria-label={t("label")} className="lbh-trust border-y border-rule bg-paper" data-testid="home-trust">
      <ul className="ds-wrap grid grid-cols-2 md:grid-cols-4">
        {keys.map((k) => (
          <li key={k} className="lbh-trust-item flex items-center gap-3 py-4 md:justify-center md:gap-4 md:py-0">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-8 w-8 shrink-0 text-forest md:h-10 md:w-10">
              {TRUST_ICONS[k]}
            </svg>
            <span className="max-w-[9rem] font-serif text-[0.98rem] leading-tight text-charcoal md:text-[1.15rem]">
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
/* Services — alternating editorial rows                              */
/* ------------------------------------------------------------------ */
export function ServicesEditorial({ photos }: { photos: HomePhotos }) {
  const t = useTranslations("site.home.services");
  const ts = useTranslations("site");
  const rows = [
    { key: "land", photo: photos.land },
    { key: "materials", photo: photos.materials },
    { key: "onsite", photo: photos.onsite },
    { key: "reporting", photo: photos.reporting },
  ] as const;
  return (
    <section aria-labelledby="services-title" className="py-16 md:py-24" data-testid="home-services">
      <div className="ds-wrap">
        <div className="grid gap-6 md:grid-cols-12">
          <div className="md:col-span-5">
            <p className="ds-eyebrow">{t("eyebrow")}</p>
            <h2 id="services-title" className="ds-h2 mt-3">{t("title")}</h2>
          </div>
          <p className="ds-lead md:col-span-6 md:col-start-7 md:pt-8">{t("intro")}</p>
        </div>

        <div className="mt-12 space-y-14 md:mt-16 md:space-y-20">
          {rows.map((r, i) => (
            <article key={r.key} id={r.key} className="grid scroll-mt-24 items-center gap-6 md:grid-cols-12 md:gap-10">
              <Photo
                photo={r.photo}
                sizes="(min-width: 768px) 55vw, 100vw"
                className={`aspect-[4/3] w-full rounded-[3px] md:col-span-7 ${i % 2 ? "md:order-2" : ""}`}
                stockLabel={ts("stockPhoto")}
              />
              <div className={`md:col-span-5 ${i % 2 ? "md:order-1" : ""}`}>
                <p className="font-serif text-lg text-stone-ink">{String(i + 1).padStart(2, "0")}</p>
                <h3 className="ds-h3 mt-1 text-[1.6rem]">{t(`${r.key}.title`)}</h3>
                <p className="ds-body mt-3">{t(`${r.key}.text`)}</p>
                <ul className="mt-4 space-y-1.5 text-[15px] text-charcoal">
                  {[1, 2, 3].map((n) => (
                    <li key={n} className="flex gap-2.5">
                      <span aria-hidden className="mt-[0.6rem] h-px w-3 shrink-0 bg-forest" />
                      {t(`${r.key}.p${n}`)}
                    </li>
                  ))}
                </ul>
                <Link href={`/services#${r.key}`} className="ds-link mt-5 inline-block text-[15px]">
                  {t("more")}
                  <span className="sr-only"> — {t(`${r.key}.title`)}</span>
                </Link>
              </div>
            </article>
          ))}
        </div>

        <p className="mt-14 border-t border-rule pt-5 text-sm text-slate" data-testid="camera-soon">
          <span className="ds-tag mr-2">{t("soonTag")}</span>
          {t("camera")}
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Build Account — a real product preview with labelled sample data   */
/* ------------------------------------------------------------------ */
export function BuildAccountShowcase() {
  const t = useTranslations("site.home.ba");
  const features = ["f1", "f2", "f3", "f4", "f5"] as const;
  const stages = [
    { name: t("demo.s1"), state: "done" },
    { name: t("demo.s2"), state: "done" },
    { name: t("demo.s3"), state: "now" },
    { name: t("demo.s4"), state: "next" },
    { name: t("demo.s5"), state: "next" },
  ];
  return (
    <section aria-labelledby="ba-title" className="bg-forest py-16 text-[#e8e4d8] md:py-24" data-testid="home-ba">
      <div className="ds-wrap grid gap-12 md:grid-cols-12 md:items-center">
        <div className="md:col-span-5">
          <p className="ds-eyebrow text-[#c9bfa6]">{t("eyebrow")}</p>
          <h2 id="ba-title" className="ds-h2 mt-3 text-white">{t("title")}</h2>
          <p className="mt-4 text-[1.05rem] leading-relaxed text-[#d6d1c3]">{t("text")}</p>
          <ul className="mt-6 space-y-3 text-[15px]">
            {features.map((f) => (
              <li key={f} className="flex gap-3 border-t border-white/15 pt-3">
                <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#c9bfa6]" />
                {t(f)}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/build-account" className="ds-btn ds-btn-light">{t("cta")}</Link>
            <Link href="/signup" className="ds-btn border border-white/50 text-white hover:bg-white hover:text-charcoal">{t("cta2")}</Link>
          </div>
        </div>

        {/* product preview (sample data) */}
        <div className="md:col-span-7" aria-label={t("demo.label")}>
          <div className="overflow-hidden rounded-[6px] bg-paper text-charcoal shadow-[0_30px_60px_-20px_rgba(0,0,0,0.45)]">
            <div className="flex items-center justify-between border-b border-rule px-5 py-3">
              <span className="font-serif text-[1.05rem] text-forest">{t("demo.title")}</span>
              <span className="ds-tag ds-tag-alert" data-testid="sample-tag">{t("demo.sample")}</span>
            </div>
            <div className="grid grid-cols-3 divide-x divide-rule border-b border-rule">
              {(["budget", "spent", "left"] as const).map((k) => (
                <div key={k} className="px-4 py-4 sm:px-5">
                  <p className="text-[11px] font-semibold tracking-wider text-slate uppercase">{t(`demo.${k}`)}</p>
                  <p className="mt-1 font-serif text-xl sm:text-2xl">
                    {formatCents(k === "budget" ? SAMPLE.budget : k === "spent" ? SAMPLE.spent : SAMPLE.budget - SAMPLE.spent).replace(".00", "")}
                  </p>
                </div>
              ))}
            </div>
            <div className="px-5 py-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">{t("demo.progress")}</span>
                <span className="text-slate">{t("demo.progressValue")}</span>
              </div>
              <ol className="mt-3 grid grid-cols-5 gap-1.5">
                {stages.map((s) => (
                  <li key={s.name}>
                    <span className={`block h-1.5 rounded-full ${s.state === "done" ? "bg-forest" : s.state === "now" ? "bg-stone" : "bg-sand"}`} />
                    <span className={`mt-1.5 truncate text-[11px] ${s.state === "now" ? "block font-semibold whitespace-nowrap text-charcoal" : "hidden text-slate sm:block"}`}>{s.name}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="grid border-t border-rule sm:grid-cols-2 sm:divide-x sm:divide-rule">
              <div className="px-5 py-4">
                <p className="text-[11px] font-semibold tracking-wider text-slate uppercase">{t("demo.receipts")}</p>
                <ul className="mt-2 divide-y divide-rule text-sm">
                  {[1, 2, 3].map((n) => (
                    <li key={n} className="flex items-center justify-between py-2">
                      <span className="min-w-0 truncate">{t(`demo.r${n}`)}</span>
                      <span className="ds-tag ds-tag-green ml-3 shrink-0">{t("demo.receiptOk")} ✓</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="border-t border-rule px-5 py-4 sm:border-t-0">
                <p className="text-[11px] font-semibold tracking-wider text-slate uppercase">{t("demo.updates")}</p>
                <ul className="mt-2 space-y-2.5 text-sm">
                  {[1, 2, 3].map((n) => (
                    <li key={n} className="flex gap-2.5">
                      <span aria-hidden className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${n === 1 ? "bg-[#b5541c]" : "bg-forest"}`} />
                      <span>
                        {t(`demo.u${n}`)}
                        <span className="block text-xs text-slate">{t(`demo.u${n}When`)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
          <p className="mt-3 text-xs text-[#c9c3b3]">{t("demo.note")}</p>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* How it works                                                        */
/* ------------------------------------------------------------------ */
export function Process() {
  const t = useTranslations("site.home.process");
  return (
    <section aria-labelledby="process-title" className="border-b border-rule bg-paper py-16 md:py-24" data-testid="home-process">
      <div className="ds-wrap">
        <p className="ds-eyebrow">{t("eyebrow")}</p>
        <h2 id="process-title" className="ds-h2 mt-3 max-w-2xl">{t("title")}</h2>
        <ol className="mt-12 grid gap-10 md:grid-cols-4 md:gap-8">
          {[1, 2, 3, 4].map((n) => (
            <li key={n} className="border-t border-charcoal pt-5">
              <span className="font-serif text-4xl text-stone-ink">{n}</span>
              <h3 className="mt-3 text-lg font-semibold text-charcoal">{t(`s${n}.title`)}</h3>
              <p className="ds-body mt-2">{t(`s${n}.text`)}</p>
            </li>
          ))}
        </ol>
        <Link href="/how-it-works" className="ds-link mt-10 inline-block">{t("more")}</Link>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Why LBH                                                             */
/* ------------------------------------------------------------------ */
export function WhyLbh() {
  const t = useTranslations("site.home.why");
  const keys = ["local", "oversight", "money", "photos", "contact", "account"] as const;
  return (
    <section aria-labelledby="why-title" className="py-16 md:py-24">
      <div className="ds-wrap grid gap-10 md:grid-cols-12">
        <div className="md:col-span-4">
          <p className="ds-eyebrow">{t("eyebrow")}</p>
          <h2 id="why-title" className="ds-h2 mt-3">{t("title")}</h2>
          <p className="ds-lead mt-4">{t("text")}</p>
        </div>
        <dl className="grid gap-x-10 md:col-span-7 md:col-start-6 md:grid-cols-2">
          {keys.map((k) => (
            <div key={k} className="border-t border-rule py-5">
              <dt className="font-serif text-[1.2rem] text-charcoal">{t(`${k}.title`)}</dt>
              <dd className="ds-body mt-1.5">{t(`${k}.text`)}</dd>
            </div>
          ))}
        </dl>
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
    <section aria-labelledby="cta-title" className="bg-sand py-16 md:py-20">
      <div className="ds-wrap flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
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
