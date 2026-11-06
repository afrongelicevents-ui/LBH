import Image from "next/image";
import { useTranslations } from "next-intl";

/**
 * "Watch your build live" banner (brief §4.4): full-width dark green band,
 * phone mockup with live feed + red LIVE badge on the left, text centre,
 * gold "Coming soon" pill on the right.
 */
export default function LiveBanner() {
  const t = useTranslations();

  return (
    <section className="relative overflow-hidden bg-forest">
      {/* Site photo faded into green */}
      <div aria-hidden className="absolute inset-0">
        <Image
          src="/images/live-feed.jpg"
          alt=""
          fill
          sizes="100vw"
          className="object-cover opacity-25"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, rgba(22,58,43,0.55) 0%, rgba(22,58,43,0.92) 55%, rgba(22,58,43,0.98) 100%)",
          }}
        />
      </div>

      <div className="relative mx-auto flex max-w-7xl flex-col items-center gap-8 px-4 py-10 sm:px-6 md:flex-row md:gap-10 md:py-12 lg:px-8">
        {/* Phone mockup with live feed */}
        <div className="w-56 shrink-0 md:w-64">
          <div className="rounded-[1.75rem] border-4 border-ink/80 bg-ink/80 shadow-xl">
            <div className="relative aspect-video overflow-hidden rounded-[1.4rem]">
              <Image
                src="/images/live-feed.jpg"
                alt=""
                fill
                sizes="256px"
                className="object-cover"
              />
              <span className="absolute top-2 left-2 flex items-center gap-1.5 rounded bg-red-600 px-2 py-0.5 text-[10px] font-extrabold tracking-wider text-white">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-white" />
                {t("home.live.liveBadge")}
              </span>
            </div>
          </div>
        </div>

        <div className="flex-1 text-center text-white md:text-left">
          <h2 className="headline text-3xl md:text-4xl">{t("home.live.title")}</h2>
          <p className="mt-3 text-base text-white/85 md:text-lg">
            {t("home.live.subtitle")}
          </p>
        </div>

        <span className="pill-soon shrink-0 px-5 py-2.5 text-sm">
          {t("common.comingSoon")}
        </span>
      </div>
    </section>
  );
}
