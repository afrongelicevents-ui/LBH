import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ArrowRightIcon, ReceiptIcon } from "./icons";

/** LBH Build Account — live service card (opens /build-account). */
export default function FinanceTrackerCard({ className = "", portal = false }: { className?: string; portal?: boolean }) {
  const t = useTranslations("financeTracker");
  return (
    <section id="build-account" aria-labelledby="ba-card-title" className={`card scroll-mt-24 p-5 md:p-6 ${className}`} data-testid="ba-card">
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-forest text-white">
          <ReceiptIcon width={24} height={24} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="ba-card-title" className="text-lg font-bold text-forest md:text-xl">
              {t("title")}
            </h2>
            <span className="badge badge-ok">{t("live")}</span>
          </div>
          <p className="mt-1 text-sm text-muted md:text-base">{t("tagline")}</p>
          <Link href={portal ? "/portal/build-account" : "/build-account"} className="btn-details mt-3" data-testid="ba-card-open">
            {t("open")}
            <ArrowRightIcon width={16} height={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}
