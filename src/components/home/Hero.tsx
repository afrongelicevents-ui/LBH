import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ArrowRightIcon } from "@/components/icons";

/**
 * Full-bleed hero: ONE photo fills the whole section edge to edge
 * (object-cover, no box or frame). A green "mist" gradient sits ONLY
 * where the text is — the right side of the photo stays clear.
 */
export default function Hero() {
  const t = useTranslations("home.hero");

  return (
    <section className="relative min-h-[360px] w-full md:min-h-[600px]">
      <Image
        src="/images/hero.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-[70%_40%]"
      />
      {/* Desktop mist: text area only, photo fully clear from ~65% */}
      <div
        aria-hidden
        className="absolute inset-0 hidden md:block"
        style={{
          background:
            "linear-gradient(to right, rgba(22,58,43,0.95) 0%, rgba(22,58,43,0.85) 30%, rgba(22,58,43,0.4) 50%, rgba(22,58,43,0) 65%)",
        }}
      />
      {/* Mobile mist: same idea, photo stays visible on the right */}
      <div
        aria-hidden
        className="absolute inset-0 md:hidden"
        style={{
          background:
            "linear-gradient(to right, rgba(22,58,43,0.95) 0%, rgba(22,58,43,0.85) 40%, rgba(22,58,43,0) 75%)",
        }}
      />

      <div className="relative mx-auto flex min-h-[360px] max-w-7xl items-center px-4 sm:px-6 md:min-h-[600px] lg:px-8">
        <div className="max-w-[78%] py-7 text-white sm:max-w-xl md:w-[45%] md:py-16">
          <h1 className="headline max-w-[7em] text-[34px] sm:max-w-none sm:text-5xl lg:text-7xl">
            {t("headline")}
          </h1>
          <p className="mt-2.5 text-lg font-semibold md:mt-4 md:text-2xl">
            {t("subline")}
          </p>
          <span aria-hidden className="mt-3 block h-1 w-14 rounded bg-gold md:mt-4 md:w-16" />
          <p className="mt-4 text-sm font-bold md:mt-6 md:text-lg">{t("trustLine")}</p>
          <Link
            href="/book-a-call"
            className="btn btn-gold mt-5 min-h-10 px-5 text-sm md:mt-7 md:px-7 md:text-base"
          >
            {t("cta")}
            <ArrowRightIcon width={18} height={18} />
          </Link>
        </div>
      </div>
    </section>
  );
}
