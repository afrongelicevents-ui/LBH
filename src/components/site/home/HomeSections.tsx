import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import Photo, { type PhotoSource } from "@/components/site/Photo";
import { formatCents } from "@/lib/money";

/** Illustration only — clearly labelled "Sample data" on the page. */
const SAMPLE = { budget: 4200000, spent: 1845000 };

export type HomePhotos = Record<"hero" | "land" | "materials" | "onsite" | "reporting", PhotoSource>;

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */
export function HomeHero({ photo }: { photo: PhotoSource }) {
  const t = useTranslations("site.home.hero");
  const ts = useTranslations("site");
  return (
    <section className="relative isolate" aria-labelledby="hero-title" data-testid="home-hero">
      <div className="relative md:min-h-[620px] lg:min-h-[680px]">
        {/* one photo for every screen: on top on phones, behind the text on larger screens */}
        <div className="relative h-[46vh] min-h-[280px] md:absolute md:inset-0 md:h-auto md:min-h-0">
          <Photo photo={photo} sizes="100vw" priority className="h-full w-full" stockLabel={ts("stockPhoto")} />
          <div aria-hidden className="absolute inset-y-0 left-0 hidden w-[62%] bg-gradient-to-r from-charcoal/70 via-charcoal/40 to-transparent md:block" />
        </div>
        <div className="ds-wrap relative py-10 md:flex md:min-h-[620px] md:items-end md:py-20 lg:min-h-[680px]">
          <div className="max-w-xl md:text-white">
            <p className="ds-eyebrow md:text-[#e6e1d3]">{t("eyebrow")}</p>
            <h1 id="hero-title" className="ds-display mt-4 text-charcoal md:text-white">
              {t("title")}
            </h1>
            <p className="mt-4 font-serif text-2xl italic text-forest md:text-[#f1ede2]">{t("subtitle")}</p>
            <p className="ds-lead mt-4 md:text-[#e6e1d3]">{t("text")}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="/book-a-call" className="ds-btn ds-btn-primary md:bg-paper md:text-charcoal md:hover:bg-white" data-testid="hero-cta">
                {t("cta")}
              </Link>
              <Link href="/how-it-works" className="ds-btn ds-btn-outline md:border-white/70 md:text-white md:hover:bg-white md:hover:text-charcoal">
                {t("secondary")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Trust indicators — a quiet row, not cards                          */
/* ------------------------------------------------------------------ */
const TRUST_ICONS: Record<string, React.ReactNode> = {
  verified: <path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3zM8.8 12.2l2.2 2.2 4.4-4.6" />,
  process: <path d="M5 5h14v14H5zM9 9h6M9 12h6M9 15h4" />,
  photos: <path d="M4 8h3l1.5-2h7L17 8h3v11H4zM12 17a3.5 3.5 0 100-7 3.5 3.5 0 000 7z" />,
  support: <path d="M5 13v-1a7 7 0 0114 0v1M5 13h3v5H5zM16 13h3v5h-3M16 18c0 1.5-1.5 2.5-4 2.5" />,
};
export function TrustRow() {
  const t = useTranslations("site.home.trust");
  const keys = ["verified", "process", "photos", "support"] as const;
  return (
    <section aria-label={t("label")} className="border-b border-rule bg-paper">
      <ul className="ds-wrap grid grid-cols-2 gap-x-6 gap-y-6 py-8 md:grid-cols-4 md:py-10">
        {keys.map((k) => (
          <li key={k} className="flex items-start gap-3">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="mt-0.5 shrink-0 text-forest">
              {TRUST_ICONS[k]}
            </svg>
            <span>
              <span className="block text-[15px] font-semibold text-charcoal">{t(`${k}.title`)}</span>
              <span className="mt-0.5 block text-sm leading-snug text-slate">{t(`${k}.text`)}</span>
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
