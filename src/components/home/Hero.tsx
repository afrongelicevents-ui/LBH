import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ArrowRightIcon } from "@/components/icons";

/**
 * Full-bleed hero (brief §4): ONE full-width background photo, edge to edge,
 * text on top over a dark green gradient overlay. No two-column layout,
 * no image box or card.
 */
export default function Hero() {
  const t = useTranslations("home.hero");

  return (
    <section className="relative min-h-[85vh] w-full md:min-h-[600px]">
      <Image
        src="/images/hero.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      {/* Dark green gradient overlay — desktop: left → transparent; mobile: heavier from top-left */}
      <div
        aria-hidden
        className="absolute inset-0 hidden md:block"
        style={{
          background:
            "linear-gradient(90deg, rgba(22,58,43,0.95) 0%, rgba(22,58,43,0.75) 35%, rgba(22,58,43,0) 65%)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 md:hidden"
        style={{
          background:
            "linear-gradient(135deg, rgba(22,58,43,0.95) 0%, rgba(22,58,43,0.72) 45%, rgba(22,58,43,0.35) 100%)",
        }}
      />

      <div className="relative mx-auto flex min-h-[85vh] max-w-7xl items-center px-4 sm:px-6 md:min-h-[600px] lg:px-8">
        <div className="max-w-xl py-16 text-white md:w-[45%]">
          <h1 className="headline text-[40px] sm:text-5xl lg:text-7xl">
            {t("headline")}
          </h1>
          <p className="mt-4 text-xl font-semibold sm:text-2xl">{t("subline")}</p>
          <span aria-hidden className="mt-4 block h-1 w-16 rounded bg-gold" />
          <p className="mt-6 text-base font-bold sm:text-lg">{t("trustLine")}</p>
          <Link href="/book-a-call" className="btn btn-gold mt-7 px-7 text-base">
            {t("cta")}
            <ArrowRightIcon width={20} height={20} />
          </Link>
        </div>
      </div>
    </section>
  );
}
