import { useTranslations } from "next-intl";
import NotifyMeForm from "./NotifyMeForm";
import { ReceiptIcon } from "./icons";

/** "Coming soon" — Build Finance Tracker, with a Notify me capture. */
export default function FinanceTrackerCard({ className = "" }: { className?: string }) {
  const t = useTranslations("financeTracker");
  return (
    <section id="finance" aria-labelledby="finance-title" className={`card scroll-mt-24 p-5 md:p-6 ${className}`}>
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-forest text-white">
          <ReceiptIcon width={24} height={24} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="finance-title" className="text-lg font-bold text-forest md:text-xl">
              {t("title")}
            </h2>
            <span className="pill-soon">{t("comingSoon")}</span>
          </div>
          <p className="mt-1 text-sm text-muted md:text-base">{t("tagline")}</p>
          <NotifyMeForm service="finance" />
        </div>
      </div>
    </section>
  );
}
