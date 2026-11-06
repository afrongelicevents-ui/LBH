import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  GoldRoofIcon,
  CalendarIcon,
  ArrowRightIcon,
} from "@/components/icons";

/**
 * Call-to-action band.
 * Mobile (phone mockup): one full-width dark green tappable bar —
 * calendar icon + "Book your free first call" + arrow, white text.
 * Desktop: dark green band, gold roof outline, heading + gold pill button.
 */
export default function CtaBand() {
  const t = useTranslations();

  return (
    <section className="bg-forest">
      {/* Mobile: the whole bar is the button */}
      <Link
        href="/book-a-call"
        className="flex min-h-12 items-center justify-center gap-2.5 px-4 py-3 text-white md:hidden"
      >
        <CalendarIcon width={22} height={22} className="shrink-0 text-gold" />
        <span className="text-base font-extrabold">{t("home.cta.title")}</span>
        <ArrowRightIcon width={18} height={18} className="shrink-0 text-gold" />
      </Link>

      {/* Desktop */}
      <div className="relative hidden overflow-hidden md:block">
        <GoldRoofIcon
          aria-hidden
          className="absolute -bottom-2 left-0 h-32 w-auto text-gold opacity-80"
        />
        <div className="relative mx-auto flex max-w-7xl items-center justify-center gap-8 px-6 py-12 lg:px-8">
          <div className="flex items-center gap-3 text-white">
            <CalendarIcon width={30} height={30} className="shrink-0 text-gold" />
            <h2 className="headline text-3xl">{t("home.cta.title")}</h2>
          </div>
          <Link href="/book-a-call" className="btn btn-gold shrink-0 px-7">
            {t("common.bookCall")}
            <ArrowRightIcon width={20} height={20} />
          </Link>
        </div>
      </div>
    </section>
  );
}
