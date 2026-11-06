import Image from "next/image";
import { useTranslations } from "next-intl";

/**
 * "Watch your build live" banner: the site photo fills the WHOLE band edge
 * to edge; a green mist gradient sits only behind the headline/text on the
 * right — the photo stays visible around the phone mockup on the left.
 */
export default function LiveBanner() {
  const t = useTranslations();

  return (
    <section className="relative overflow-hidden">
      {/* Full-bleed site photo */}
      <div aria-hidden className="absolute inset-0">
        <Image
          src="/images/live-feed.jpg"
          alt=""
          fill
          sizes="100vw"
          className="object-cover"
        />
        {/* Mist only where the text sits (right side) */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to right, rgba(22,58,43,0.15) 0%, rgba(22,58,43,0.55) 35%, rgba(22,58,43,0.93) 62%, rgba(22,58,43,0.95) 100%)",
          }}
        />
      </div>

      <div className="relative mx-auto flex min-h-40 max-w-7xl items-center gap-3 px-4 py-4 sm:px-6 md:min-h-0 md:gap-10 md:py-12 lg:px-8">
        {/* Phone mockup with live feed */}
        <div className="w-28 shrink-0 sm:w-40 md:w-64">
          <div className="rounded-xl border-[3px] border-ink/80 bg-ink/80 shadow-xl md:rounded-[1.75rem] md:border-4">
            <div className="relative aspect-video overflow-hidden rounded-[0.65rem] md:rounded-[1.4rem]">
              <Image
                src="/images/live-feed.jpg"
                alt=""
                fill
                sizes="256px"
                className="object-cover"
              />
              <span className="absolute top-1 left-1 flex items-center gap-1 rounded bg-red-600 px-1.5 py-0.5 text-[9px] font-extrabold tracking-wider text-white md:top-2 md:left-2 md:px-2 md:text-[10px]">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-white" />
                {t("home.live.liveBadge")}
              </span>
            </div>
          </div>
        </div>

        <div className="min-w-0 flex-1 text-white">
          <h2 className="headline text-xl sm:text-2xl md:text-4xl">
            {t("home.live.title")}
          </h2>
          <p className="mt-1 text-xs text-white/90 sm:text-sm md:mt-3 md:text-lg">
            {t("home.live.subtitle")}
          </p>
          <span className="pill-soon mt-2 md:hidden">{t("common.comingSoon")}</span>
        </div>

        <span className="pill-soon hidden shrink-0 px-5 py-2.5 text-sm md:inline-flex">
          {t("common.comingSoon")}
        </span>
      </div>
    </section>
  );
}
