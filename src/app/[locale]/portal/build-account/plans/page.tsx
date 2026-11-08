import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { formatCents } from "@/lib/money";
import { loadBaPage } from "@/lib/buildAccount/page";
import BaShell from "@/components/buildAccount/BaShell";
import { SubscribeButton } from "@/components/buildAccount/PlanButtons";
import { StatusBadge } from "@/components/ui/Portal";
import { CheckIcon } from "@/components/ui/PortalIcons";

/** Build Account — Plans: free with an LBH build, else monthly / yearly. */
export default async function PlansPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ ref?: string }>;
}) {
  const { locale } = await params;
  const { ref } = await searchParams;
  setRequestLocale(locale);
  const page = await loadBaPage(locale);
  if (!page.ctx.isOwner) notFound();
  const t = await getTranslations("ba");
  const { data } = page;
  const fmt = (iso: string) => new Date(iso).toLocaleDateString(locale === "en" ? "en-GB" : locale, { day: "numeric", month: "long", year: "numeric" });
  const free = data.plan === "free";
  const paid = data.plan === "paid";
  const until = data.planInfo?.override === "paid" ? data.planInfo.override_until : data.planInfo?.paid_until;
  const { settings } = data;

  return (
    <BaShell page={page} active="plans">
      {ref && (
        <p role="status" className={`rounded-2xl p-3 text-sm font-semibold ${paid ? "bg-ok-soft text-forest" : "bg-prog-soft text-ink"}`} data-testid="ba-pay-result">
          {paid ? t("paidThanks") : t("payNotDone")}
        </p>
      )}
      <section className="card p-4" data-testid="ba-plan-status">
        <p className="text-sm text-muted">{t("yourPlan")}</p>
        <p className="mt-1 text-lg font-extrabold text-ink">
          {t(`planName.${data.plan}`)}
          {paid && until && <span className="ml-2 text-sm font-semibold text-muted">· {t("until", { date: fmt(until) })}</span>}
        </p>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <section className={`card p-5 ${free ? "ring-2 ring-forest" : ""}`} data-testid="plan-free">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-extrabold text-ink">{t("planFreeTitle")}</h2>
            {free && <StatusBadge tone="ok">{t("current")}</StatusBadge>}
          </div>
          <p className="mt-2 text-3xl font-extrabold text-forest">{t("free")}</p>
          <p className="mt-2 text-sm text-muted">{t("planFreeText")}</p>
        </section>
        <section className={`card p-5 ${paid ? "ring-2 ring-forest" : ""}`} data-testid="plan-paid">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-extrabold text-ink">{t("planPaidTitle")}</h2>
            {paid && <StatusBadge tone="ok">{t("current")}</StatusBadge>}
          </div>
          {settings.enabled && settings.monthly_cents ? (
            <>
              <p className="mt-2 text-3xl font-extrabold text-forest">
                {formatCents(settings.monthly_cents)}
                <span className="text-base font-semibold text-muted"> / {t("month")}</span>
              </p>
              {settings.yearly_cents && <p className="text-sm text-muted">{t("orYearly", { price: formatCents(settings.yearly_cents) })}</p>}
            </>
          ) : (
            <p className="mt-2 text-sm font-semibold text-muted">{t("planUnavailable")}</p>
          )}
          <ul className="mt-3 space-y-1.5 text-sm text-ink">
            {(["f1", "f2", "f3", "f4"] as const).map((k) => (
              <li key={k} className="flex items-start gap-2">
                <CheckIcon size={16} className="mt-0.5 shrink-0 text-ok" />
                {t(`feature.${k}`)}
              </li>
            ))}
          </ul>
          {!free && settings.enabled && settings.monthly_cents && (
            <div className="mt-4 space-y-2">
              <SubscribeButton plan="monthly" label={paid ? t("payAnotherMonth") : t("subscribeMonthly", { price: formatCents(settings.monthly_cents) })} />
              {settings.yearly_cents && <SubscribeButton plan="yearly" label={t("subscribeYearly", { price: formatCents(settings.yearly_cents) })} />}
              <p className="text-[11px] text-muted">{t("readOnlyRule")}</p>
            </div>
          )}
        </section>
      </div>
    </BaShell>
  );
}
