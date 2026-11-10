import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatCents } from "@/lib/money";
import { loadBaPage } from "@/lib/buildAccount/page";
import * as M from "@/lib/buildAccount/math";
import { accountName, currentMonth } from "@/lib/buildAccount/view";
import BaShell from "@/components/buildAccount/BaShell";
import { StatTiles } from "@/components/ui/Portal";
import { SendIcon, CalendarIcon, ListIcon, DollarIcon } from "@/components/ui/PortalIcons";

/** Build Account — Money sent: totals, per month, per service, per account. */
export default async function MoneySentPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ owner?: string }>;
}) {
  const { locale } = await params;
  const { owner } = await searchParams;
  setRequestLocale(locale);
  const page = await loadBaPage(locale, owner);
  const t = await getTranslations("ba");
  const s = M.sentStats(page.data.entries, currentMonth(), 6);
  const max = Math.max(1, ...s.by_month.map((m) => m.cents));
  const monthLabel = (m: string) => new Date(`${m}-15T12:00:00`).toLocaleDateString(locale === "en" ? "en-GB" : locale, { month: "short" });

  return (
    <BaShell page={page} active="sent">
      <StatTiles
        tiles={[
          { label: t("totalSent"), value: formatCents(s.total_cents), icon: <SendIcon size={20} />, tone: "forest" },
          { label: t("sentThisMonth"), value: formatCents(s.this_month_cents), icon: <CalendarIcon size={20} />, tone: "ok" },
          { label: t("transfers"), value: s.transfers, icon: <ListIcon size={20} />, tone: "prog" },
          { label: t("feesPaid"), value: formatCents(s.fees_cents), icon: <DollarIcon size={20} />, tone: "done" },
        ]}
      />
      <section className="card p-4" data-testid="ba-chart">
        <h2 className="text-base font-extrabold text-ink">{t("chartTitle")}</h2>
        <div className="mt-4 flex h-44 items-end gap-2" role="img" aria-label={t("chartTitle")}>
          {s.by_month.map((m) => (
            <div key={m.month} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <span className={`text-[10px] font-semibold ${m.month === s.by_month[s.by_month.length - 1].month && m.cents ? "rounded-md bg-forest px-1.5 py-0.5 text-white" : "text-muted"}`}>{m.cents ? formatCents(m.cents).replace(".00", "") : ""}</span>
              <span className="w-full rounded-t-lg bg-forest" style={{ height: `${Math.max(m.cents ? 4 : 1, (m.cents / max) * 100)}%`, opacity: m.cents ? 1 : 0.15 }} />
              <span className="text-[11px] font-semibold text-ink">{monthLabel(m.month)}</span>
            </div>
          ))}
        </div>
      </section>
      <div className="grid gap-3 sm:grid-cols-2">
        <section className="card p-4">
          <h2 className="text-base font-extrabold text-ink">{t("byService")}</h2>
          <ul className="mt-2 space-y-1.5 text-sm">
            {s.by_service.length === 0 && <li className="text-muted">{t("nothingYet")}</li>}
            {s.by_service.map((x) => (
              <li key={x.service} className="flex items-center justify-between gap-2" data-testid="ba-service-row">
                <span className="flex min-w-0 items-center gap-2">
                  <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ok-soft text-[11px] font-extrabold text-forest">
                    {t(`service.${x.service}` as never).slice(0, 1)}
                  </span>
                  <span className="truncate">
                    {t(`service.${x.service}` as never)} <span className="text-muted">· {x.count}×</span>
                  </span>
                </span>
                <span className="flex shrink-0 gap-3">
                  <strong>{formatCents(x.cents)}</strong>
                  <span className="w-10 text-right text-muted">{s.total_cents ? Math.round((x.cents / s.total_cents) * 100) : 0}%</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section className="card p-4">
          <h2 className="text-base font-extrabold text-ink">{t("byAccount")}</h2>
          <ul className="mt-2 space-y-1.5 text-sm">
            {s.by_account.length === 0 && <li className="text-muted">{t("nothingYet")}</li>}
            {s.by_account.map((x) => (
              <li key={x.account_id} className="flex justify-between gap-2">
                <span>{accountName(page.data, x.account_id)}</span>
                <strong>{formatCents(x.cents)}</strong>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </BaShell>
  );
}
