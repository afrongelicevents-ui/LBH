import { useTranslations } from "next-intl";
import { REQUEST_TIMELINE, timelineIndex, type RequestStatus } from "@/lib/status";
import { CheckIcon } from "@/components/icons";

/** My requests status timeline (brief §5.2). */
export default function StatusTimeline({ status }: { status: RequestStatus }) {
  const t = useTranslations("portal.status");
  const current = timelineIndex(status);

  if (status === "cancelled") {
    return (
      <p className="text-sm font-semibold text-red-700">{t("cancelled")}</p>
    );
  }

  const stepNo = status === "done" ? REQUEST_TIMELINE.length : Math.max(current + 1, 0);
  const label = status === "new" ? t("new") : t(status as (typeof REQUEST_TIMELINE)[number]);

  return (
    <>
      {/* Phones: one compact line + progress bar */}
      <div className="sm:hidden">
        <p className="flex items-center justify-between text-xs">
          <span className="font-bold text-forest">{label}</span>
          <span className="text-muted">
            {t("stepOf", { n: stepNo, total: REQUEST_TIMELINE.length })}
          </span>
        </p>
        <div className="mt-1.5 flex gap-0.5" aria-hidden>
          {REQUEST_TIMELINE.map((step, i) => (
            <span
              key={step}
              className={`h-1.5 flex-1 rounded-full ${
                current > i || status === "done" ? "bg-forest" : current === i ? "bg-accent" : "bg-line"
              }`}
            />
          ))}
        </div>
      </div>
    <ol className="hidden flex-wrap items-center gap-y-2 sm:flex">
      {REQUEST_TIMELINE.map((step, i) => {
        const done = current > i || status === "done";
        const active = current === i && status !== "done";
        return (
          <li key={step} className="flex items-center">
            <span
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap ${
                done
                  ? "bg-forest text-white"
                  : active
                    ? "bg-accent text-white"
                    : "bg-line/60 text-muted"
              }`}
            >
              {done && <CheckIcon width={11} height={11} />}
              {t(step)}
            </span>
            {i < REQUEST_TIMELINE.length - 1 && (
              <span
                aria-hidden
                className={`mx-1 h-px w-3 ${done ? "bg-forest" : "bg-line"}`}
              />
            )}
          </li>
        );
      })}
    </ol>
    </>
  );
}
