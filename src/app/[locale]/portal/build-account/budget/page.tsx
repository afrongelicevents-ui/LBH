import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatCents } from "@/lib/money";
import { loadBaPage } from "@/lib/buildAccount/page";
import * as M from "@/lib/buildAccount/math";
import BaShell from "@/components/buildAccount/BaShell";
import BudgetInput from "@/components/buildAccount/BudgetInput";
import { StatusBadge } from "@/components/ui/Portal";

/** Build Account — Budget by stage (Foundation → Finishes). */
export default async function BudgetPage({
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
  const rows = M.stageBudgets(page.data.entries, page.data.stages, page.data.budgets);
  const totalBudget = rows.reduce((s, r) => s + (r.budget_cents ?? 0), 0);
  const totalSpent = rows.reduce((s, r) => s + r.spent_cents, 0);
  const canEdit = page.ctx.isOwner && page.writable;

  return (
    <BaShell page={page} active="budget">
      <section className="card p-4">
        <p className="text-sm text-muted">{t("budgetIntro")}</p>
        <p className="mt-2 text-sm">
          {t("budgetTotals", { spent: formatCents(totalSpent), budget: formatCents(totalBudget) })}
        </p>
      </section>
      <ul className="space-y-3" data-testid="ba-budgets">
        {rows.map((r, i) => {
          const pct = r.budget_cents ? Math.min(100, Math.round((r.spent_cents / r.budget_cents) * 100)) : 0;
          return (
            <li key={r.stage} className="card p-4" data-testid="ba-budget-row">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-extrabold text-ink">
                  <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-ok-soft text-xs text-forest">{i + 1}</span>
                  {r.stage}
                </p>
                {r.over ? (
                  <StatusBadge tone="grey" className="!bg-red-50 !text-red-800">{t("overBudget")}</StatusBadge>
                ) : r.budget_cents !== null ? (
                  <StatusBadge tone="ok">{t("withinBudget")}</StatusBadge>
                ) : null}
              </div>
              <p className="mt-2 text-sm text-ink">
                {t("spentOf", { spent: formatCents(r.spent_cents), budget: r.budget_cents === null ? "—" : formatCents(r.budget_cents) })}
              </p>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-offwhite">
                <div className={`h-full rounded-full ${r.over ? "bg-red-600" : "bg-forest"}`} style={{ width: `${r.over ? 100 : pct}%` }} />
              </div>
              {canEdit && (
                <div className="mt-3">
                  <BudgetInput stage={r.stage} cents={r.budget_cents} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </BaShell>
  );
}
