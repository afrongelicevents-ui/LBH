import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import Photo from "@/components/site/Photo";
import { formatCents } from "@/lib/money";
import { PHOTOS } from "@/config/photos";
import { SERVICE_GROUPS } from "@/config/siteNav";
import { HarareClock } from "@/components/ws/HarareClock";

/** Illustration only — clearly labelled "Sample" on the page. */
export const SAMPLE = { budget: 4200000, spent: 1845000, stages: 6, now: 3 };

const ArrowGo = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
const Chevron = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
    <path d="m9 18 6-6-6-6" />
  </svg>
);

/* ------------------------------------------------------------------ */
/* Hero: the house photo, full bleed, headline at the bottom           */
/* ------------------------------------------------------------------ */
export function HomeHero() {
  const t = useTranslations("site.ws");
  return (
    <section className="ws-hero h-[min(92svh,780px)] min-h-[580px]" data-testid="home-hero">
      <Photo photo={PHOTOS.hero} sizes="100vw" priority hideCredit className="ws-hero-img absolute inset-0" />
      <Link href="/sample/live" className="ws-live-chip absolute top-[84px] left-5 z-[3] md:top-[96px] md:left-8 lg:left-[max(2rem,calc((100vw-1200px)/2+2rem))]" data-testid="hero-live-chip">
        <span className="ws-dot" aria-hidden />
        <HarareClock template={t.raw("liveChip") as string} />
      </Link>
      <div className="absolute inset-x-0 bottom-0 z-[2]">
        <div className="ds-wrap flex flex-col gap-4 pb-8 md:pb-16">
          <h1 className="ws-hero-title max-w-[12ch]">
            {t("heroTitleA")} <span>{t("heroTitleB")}</span>
          </h1>
          <p className="max-w-[34ch] text-[1rem] leading-[1.5] text-[#e8e4db] md:text-[1.15rem]">{t("heroText")}</p>
          <div className="flex gap-2.5 sm:max-w-md">
            <Link href="/book-a-call" className="ds-btn ds-btn-primary flex-1">{t("heroBook")}</Link>
            <Link href="/how-it-works" className="ds-btn ds-btn-ghost flex-1">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M8 5v14l11-7Z" /></svg>
              {t("heroWatch")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Land · Build · Finish — under the hero. */
export function Pillars() {
  const t = useTranslations("site.ws.pillars");
  const tg = useTranslations("site.groups");
  return (
    <nav className="border-b border-rule bg-ivory" aria-label={tg("land.title") + " · " + tg("build.title") + " · " + tg("finish.title")}>
      <div className="ws-pillars ds-wrap !border-0 !px-0 md:!px-8">
        {SERVICE_GROUPS.map((g) => (
          <Link key={g.key} href={g.href} className="hover:bg-paper">
            <b>{tg(`${g.key}.title`)}</b>
            <span>{t(g.key)}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* "Your whole build, in your pocket" + the SAMPLE Build Account card   */
/* ------------------------------------------------------------------ */
export function SampleBuildCard({ href = "/sample/build-account" }: { href?: string }) {
  const t = useTranslations("site.ws");
  const th = useTranslations("site.home.ba");
  const left = SAMPLE.budget - SAMPLE.spent;
  return (
    <Link href={href} className="ws-float-card block" data-testid="home-ba-card">
      <div className="flex items-center justify-between gap-2">
        <div>
          <small className="text-[11px] font-extrabold tracking-[0.1em] text-slate">
            {t("sampleCardLabel")} · <span className="ws-tag" data-testid="sample-tag">{t("sample")}</span>
          </small>
          <b className="mt-0.5 block text-base">{t("sampleProject")}</b>
        </div>
        <Chevron />
      </div>
      <div className="mt-3.5 mb-2.5 flex items-end justify-between">
        <div>
          <span className="text-xs text-slate">{t("leftToSpend")}</span>
          <div className="ws-big num text-[2.1rem]">{formatCents(left).replace(".00", "")}</div>
        </div>
        <span className="num text-xs text-slate">{t("ofBudget", { budget: formatCents(SAMPLE.budget).replace(".00", "") })}</span>
      </div>
      <div className="ws-track" aria-hidden>
        {Array.from({ length: SAMPLE.stages }, (_, i) => (
          <i key={i} className={i + 1 < SAMPLE.now ? "done" : i + 1 === SAMPLE.now ? "now" : ""} />
        ))}
      </div>
      <div className="mt-2.5 flex justify-between gap-2 text-[13px] text-slate">
        <span data-testid="ba-stage">
          {th("demo.stageOf", { n: SAMPLE.now, total: SAMPLE.stages })} · <b className="text-charcoal">{th(`demo.s${SAMPLE.now}`)}</b>
        </span>
        <span className="font-bold text-forest">{t("needsOk")}</span>
      </div>
    </Link>
  );
}

export function StoryPocket() {
  const t = useTranslations("site.ws");
  return (
    <section className="ds-wrap pt-10 md:pt-20" aria-labelledby="story-title" data-testid="home-ba">
      <div className="grid gap-6 md:grid-cols-12 md:items-center md:gap-12">
        <div className="md:col-span-5">
          <span className="ws-kicker">{t("storyKicker")}</span>
          <h2 id="story-title" className="ws-h-sec mt-2.5">{t("storyTitle")}</h2>
          <p className="ws-lede mt-3">{t("storyText")}</p>
          <Link href="/build-account" className="ds-link mt-5 hidden md:inline-block" data-testid="ba-see-how">
            {useTranslations("site.home.ba")("seeHow")} →
          </Link>
        </div>
        <div className="md:col-span-7">
          <div className="relative aspect-[4/4.4] overflow-hidden rounded-[28px] bg-sand md:aspect-[4/3.2]">
            <Photo photo={PHOTOS.homeAbroad} sizes="(min-width: 768px) 55vw, 100vw" hideCredit className="absolute inset-0" />
            <div className="absolute inset-x-3.5 bottom-3.5 md:right-auto md:bottom-6 md:left-6 md:w-[360px]">
              <SampleBuildCard />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Services: three big photo tiles                                     */
/* ------------------------------------------------------------------ */
const TILE_PHOTO = { land: PHOTOS.serviceLand, build: PHOTOS.serviceBuild, finish: PHOTOS.serviceFinish } as const;

export function ServiceTiles({ short = false, tall = false }: { short?: boolean; tall?: boolean }) {
  const t = useTranslations("site.ws");
  const tg = useTranslations("site.groups");
  return (
    <div className="mt-6 grid gap-3.5 md:grid-cols-3 md:gap-5" data-testid="service-tiles">
      {SERVICE_GROUPS.map((g, i) => (
        <Link key={g.key} href={g.href} className={`ws-svc ${tall ? "h-[250px] md:h-[440px]" : "h-[250px] md:h-[380px]"}`} data-testid={`tile-${g.key}`}>
          <Photo photo={TILE_PHOTO[g.key]} sizes="(min-width: 768px) 33vw, 100vw" hideCredit className="ws-svc-img" />
          <span className="ws-svc-n">{String(i + 1).padStart(2, "0")}</span>
          <div className="ws-svc-t">
            <div>
              <h3>{tg(`${g.key}.title`)}</h3>
              <p>{short ? t(`tileShort.${g.key}`) : t(`tile.${g.key}`)}</p>
            </div>
            <span className="ws-go">
              <ArrowGo />
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}

export function WhatWeDo() {
  const t = useTranslations("site.ws");
  return (
    <section className="ds-wrap pt-12 md:pt-24" aria-labelledby="what-title">
      <span className="ws-kicker">{t("whatKicker")}</span>
      <h2 id="what-title" className="ws-h-sec mt-2.5">{t("whatTitle")}</h2>
      <ServiceTiles />
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* How your money stays safe: 4 numbered steps                          */
/* ------------------------------------------------------------------ */
export function MoneySafe() {
  const t = useTranslations("site.ws");
  return (
    <section className="ds-wrap pt-12 md:pt-24" aria-labelledby="safe-title">
      <div className="grid gap-6 md:grid-cols-12 md:gap-12">
        <div className="md:col-span-4">
          <span className="ws-kicker">{t("safeKicker")}</span>
          <h2 id="safe-title" className="ws-h-sec mt-2.5">{t("safeTitle")}</h2>
        </div>
        <div className="md:col-span-8">
          <ol className="ws-how">
            {[1, 2, 3, 4].map((n) => (
              <li key={n}>
                <span className="n">{n}</span>
                <div>
                  <b>{t(`safe.s${n}t`)}</b>
                  <span className="d">{t(`safe.s${n}`)}</span>
                </div>
              </li>
            ))}
          </ol>
          <Link href="/how-it-works" className="ds-btn ds-btn-outline mt-5 w-full md:w-auto">{t("fullProcess")}</Link>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Live camera band (SAMPLE — the camera service is coming soon)        */
/* ------------------------------------------------------------------ */
export function LiveBand() {
  const t = useTranslations("site.ws");
  return (
    <section className="mt-12 bg-paper py-10 md:mt-24 md:py-20" aria-labelledby="live-title">
      <div className="ds-wrap grid gap-6 md:grid-cols-12 md:items-center md:gap-12">
        <div className="md:col-span-5">
          <span className="ws-kicker">{t("liveKicker")}</span>
          <h2 id="live-title" className="ws-h-sec mt-2.5">{t("liveTitle")}</h2>
          <p className="ws-lede mt-3">{t("liveText")}</p>
          <Link href="/sample/live" className="ds-btn ds-btn-light mt-6 hidden md:inline-flex">{t("liveOpen")}</Link>
        </div>
        <div className="md:col-span-7">
          <Link href="/sample/live" className="relative block aspect-[16/10] overflow-hidden rounded-[24px] bg-sand" aria-label={t("liveOpen")}>
            <Photo photo={PHOTOS.liveBand} sizes="(min-width: 768px) 55vw, 100vw" hideCredit className="absolute inset-0" />
            <div className="ws-hud !flex-row !items-start !justify-between">
              <span className="ws-rec"><span className="ws-dot" />REC</span>
              <span className="flex items-center gap-2">
                <span className="ws-tag !bg-[rgba(0,0,0,0.5)] !text-[#f3ede4]">{t("sample")}</span>
                <HarareClock template="{date} · {seconds} CAT" />
              </span>
            </div>
          </Link>
          <Link href="/sample/live" className="ds-btn ds-btn-light mt-5 w-full md:hidden">{t("liveOpen")}</Link>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Closing photo: "Your keys. Your home."                               */
/* ------------------------------------------------------------------ */
export function Closing() {
  const t = useTranslations("site.ws");
  return (
    <section className="ws-hero relative flex min-h-[460px] items-end md:min-h-[560px]" aria-labelledby="closing-title">
      <Photo photo={PHOTOS.closing} sizes="100vw" hideCredit className="absolute inset-0" />
      <div className="ds-wrap relative z-[2] flex flex-col items-start gap-3.5 pt-7 pb-9 md:pb-16">
        <h2 id="closing-title" className="font-serif text-[2.75rem] leading-[0.95] font-extrabold tracking-[-0.04em] md:text-[4rem]">{t("closingTitle")}</h2>
        <p className="text-base text-[#e8e4db] md:text-lg">{t("closingText")}</p>
        <Link href="/book-a-call" className="ds-btn ds-btn-primary" data-testid="final-cta">{t("heroBook")}</Link>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Build Account info page: the sample card on its own                 */
/* ------------------------------------------------------------------ */
export function BuildAccountPreview() {
  const t = useTranslations("site.ws");
  return (
    <section className="ds-wrap py-8 md:py-12" data-testid="home-ba" aria-label={t("sampleCardLabel")}>
      <div className="relative overflow-hidden rounded-[28px] bg-sand p-4 md:p-8">
        <div className="md:max-w-[420px]">
          <SampleBuildCard />
        </div>
      </div>
    </section>
  );
}
