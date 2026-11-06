import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  GoldRoofIcon,
  CalendarIcon,
  ArrowRightIcon,
} from "@/components/icons";

/** Call-to-action band (brief §4.6): dark green, gold roof outline, calendar icon + gold pill button. */
export default function CtaBand() {
  const t = useTranslations();

  return (
    <section className="relative overflow-hidden bg-forest">
      <GoldRoofIcon
        aria-hidden
        className="absolute -bottom-2 left-0 h-24 w-auto text-gold opacity-80 md:h-32"
      />
      <div className="relative mx-auto flex max-w-7xl flex-col items-center justify-center gap-5 px-4 py-10 sm:px-6 md:flex-row md:gap-8 md:py-12 lg:px-8">
        <div className="flex items-center gap-3 text-white">
          <CalendarIcon width={30} height={30} className="shrink-0 text-gold" />
          <h2 className="headline text-2xl md:text-3xl">{t("home.cta.title")}</h2>
        </div>
        <Link href="/book-a-call" className="btn btn-gold shrink-0 px-7">
          {t("common.bookCall")}
          <ArrowRightIcon width={20} height={20} />
        </Link>
      </div>
    </section>
  );
}
