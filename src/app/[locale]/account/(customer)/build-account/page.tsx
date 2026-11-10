import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatCents } from "@/lib/money";
import { loadBaPage } from "@/lib/buildAccount/page";
import * as M from "@/lib/buildAccount/math";
import { accountName, currentMonth, receiverOf } from "@/lib/buildAccount/view";
import BaShell from "@/components/buildAccount/BaShell";
import { ConfirmTransferButtons } from "@/components/buildAccount/BaButtons";
import { StatTiles, StatusBadge } from "@/components/ui/Portal";
import { ArrowRightIcon, CameraIcon, PlusIcon, SendIcon, DollarIcon, CalendarIcon, BellIcon, HomeIcon, UserIcon, UsersIcon, ChevronRightIcon, CheckIcon } from "@/components/ui/PortalIcons";

/** Build Account — Home: balance, totals, actions, alerts. */
export default async function BuildAccountHome({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ owner?: string; acct?: string }>;
}) {
  const { locale } = await params;
  const { owner, acct } = await searchParams;
  setRequestLocale(locale);
  const page = await loadBaPage(locale, owner);
  const t = await getTranslations("ba");
  const { data, ctx, ownerQs } = page;

  const selected = acct && data.accounts.some((a) => a.id === acct) ? acct : "all";
  const view = M.inAccount(data.entries, selected);
  const month = currentMonth();
  const budgets = M.stageBudgets(data.entries, data.stages, data.budgets);
  const alerts = M.alerts(data.entries, data.accounts, data.priceList, budgets);
  const noReceipt = alerts.filter((a): a is Extract<M.Alert, { kind: "no_receipt" }> => a.kind === "no_receipt");
  const otherAlerts = alerts.filter((a) => a.kind !== "no_receipt");
  const activeMembers = data.members.filter((m) => m.status === "active");
  const pending = data.entries.filter((e) => e.direction === "in" && e.status === "pending");
  const qs = (a: string) => {
    const p = new URLSearchParams();
    if (!ctx.isOwner) p.set("owner", ctx.ownerId);
    if (a !== "all") p.set("acct", a);
    const s = p.toString();
    return s ? `?${s}` : "";
  };
  const canScan = data.accounts.some((a) => page.canAddTo(a.id));
  const fmtDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(locale === "en" ? "en-GB" : locale, { day: "numeric", month: "short" });

  return (
    <BaShell page={page} active="home">
      {ctx.isOwner && data.plan === "none" && (
        <section className="rounded-[22px] bg-ok-soft p-4" data-testid="ba-start">
          <p className="text-base font-extrabold text-ink">{t("startTitle")}</p>
          <p className="mt-1 text-sm text-ink">{t("startText")}</p>
          <Link href="/account/build-account/plans" className="btn-details mt-3">
            {t("seePlans")}
            <ArrowRightIcon size={16} />
          </Link>
        </section>
      )}

      {ctx.isOwner && activeMembers.length > 0 && (
        <p className="inline-flex flex-wrap items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-ink shadow-sm" data-testid="ba-shared-with">
          <UsersIcon size={14} className="text-forest" />
          {t("sharedWith", { names: activeMembers.map((m) => `${m.name.replace(/^SAMPLE\s+/, "")} – ${t(`role.${m.role}` as never)}`).join(", ") })}
        </p>
      )}

      {/* account switcher */}
      <nav aria-label={t("accounts")} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {[{ id: "all", name: t("allAccounts") }, ...data.accounts.map((a) => ({ id: a.id, name: accountName(data, a.id) }))].map((a) => (
          <Link key={a.id} href={`/account/build-account${qs(a.id)}`} className="chip" aria-pressed={selected === a.id}>
            {a.name}
          </Link>
        ))}
      </nav>

      {/* balance */}
      <section className="relative overflow-hidden rounded-[26px] bg-forest p-5 text-white shadow-(--shadow-card)" data-testid="ba-balance">
        <div aria-hidden className="absolute -top-16 -right-10 h-48 w-48 rounded-full bg-white/5" />
        <Link href={`/account/build-account/statement${qs(selected)}`} aria-label={t("seeStatement")} className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20">
          <ChevronRightIcon size={18} />
        </Link>
        <p className="text-sm font-medium text-white/80">{t("available")}</p>
        <p className="mt-1 text-4xl font-extrabold tracking-tight" data-testid="ba-balance-amount">
          {formatCents(M.balance(view))}
        </p>
        <p className="mt-1 text-xs text-white/80">
          {selected === "all" ? t("allAccounts") : accountName(data, selected)}
          {M.onItsWay(view) > 0 && ` · ${t("onItsWayAmount", { amount: formatCents(M.onItsWay(view)) })}`}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {canScan && (
            <Link href={`/account/build-account/scan${ownerQs}`} className="btn btn-white min-h-11 text-sm" data-testid="ba-scan-btn">
              <CameraIcon size={18} />
              {t("scanReceipt")}
            </Link>
          )}
          {ctx.isOwner && page.writable && (
            <Link href="/account/build-account/add" className="btn btn-outline-white min-h-11 text-sm" data-testid="ba-add-btn">
              <PlusIcon size={18} />
              {t("addMoney")}
            </Link>
          )}
        </div>
      </section>

      <StatTiles
        tiles={[
          { label: t("moneyIn"), value: formatCents(M.moneyIn(view)), icon: <SendIcon size={20} />, tone: "ok" },
          { label: t("spent"), value: formatCents(M.spent(view)), icon: <DollarIcon size={20} />, tone: "done" },
          { label: t("sentThisMonth"), value: formatCents(M.sentInMonth(view, month)), icon: <CalendarIcon size={20} />, tone: "prog" },
        ]}
      />

      {data.accounts.length > 1 && (
        <section className="card divide-y divide-[#eef0ef] px-4" data-testid="ba-accounts">
          {data.accounts.map((a) => {
            const bal = M.balance(M.inAccount(data.entries, a.id));
            const owes = alerts.some((x) => x.kind === "unbacked" && x.account_id === a.id);
            return (
              <Link key={a.id} href={`/account/build-account${qs(a.id)}`} className="flex items-center gap-3 py-3">
                <span className="icon-round icon-forest h-10 w-10 shrink-0">{a.kind === "lbh" ? <HomeIcon size={18} /> : <UserIcon size={18} />}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-ink">{accountName(data, a.id)}</span>
                  <span className="block text-sm font-extrabold text-ink">{formatCents(bal)}</span>
                </span>
                {owes ? <ChevronRightIcon size={18} className="text-muted" /> : <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ok text-white"><CheckIcon size={14} /></span>}
              </Link>
            );
          })}
        </section>
      )}

      {pending.length > 0 && (
        <section className="card p-4" data-testid="ba-pending">
          <h2 className="text-base font-extrabold text-ink">{t("onItsWay")}</h2>
          <ul className="mt-2 divide-y divide-[#eef0ef]">
            {pending.map((e) => {
              const who = receiverOf(data.accounts.find((a) => a.id === e.account_id), ctx);
              return (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span>
                    <strong>{formatCents(e.amount_cents)}</strong> → {accountName(data, e.account_id)}
                    <span className="text-muted"> · {fmtDate(e.occurred_on)}</span>
                  </span>
                  {who === "me" ? (
                    <ConfirmTransferButtons ownerId={ctx.ownerId} entryId={e.id} />
                  ) : (
                    <StatusBadge tone="prog">{t(`waitFor.${who}`)}</StatusBadge>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="card p-4" data-testid="ba-alerts">
        <h2 className="flex items-center gap-2 text-base font-extrabold text-ink">
          <BellIcon size={18} className="text-forest" />
          {t("alerts")}
          {alerts.length > 0 && <span className="rounded-full bg-forest px-2 text-xs text-white">{alerts.length}</span>}
        </h2>
        {alerts.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{t("noAlerts")}</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {noReceipt.length > 0 && (
              <li className="flex items-start gap-2 rounded-xl bg-offwhite p-2.5" data-alert="no_receipt">
                <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-600" />
                <Link href={`/account/build-account/statement${qs(selected)}${qs(selected) ? "&" : "?"}f=noreceipt`} className="flex-1 hover:underline">
                  {t("alert.noReceiptCount", { count: noReceipt.length, amount: formatCents(noReceipt.reduce((s, a) => s + a.amount_cents, 0)) })}
                </Link>
              </li>
            )}
            {otherAlerts.slice(0, 8).map((a, i) => (
              <li key={i} className="flex items-start gap-2 rounded-xl bg-offwhite p-2.5" data-alert={a.kind}>
                <span aria-hidden className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${a.kind === "price" ? "bg-amber-500" : a.kind === "over_budget" ? "bg-red-600" : "bg-blue-600"}`} />
                <span className="flex-1">
                {a.kind === "price" &&
                  t("alert.price", { item: a.item.replace(/^SAMPLE\s+/, ""), paid: formatCents(a.paid_cents), usual: formatCents(a.usual_cents), unit: a.unit, area: a.area })}
                {a.kind === "over_budget" && t("alert.overBudget", { stage: a.stage, spent: formatCents(a.spent_cents), budget: formatCents(a.budget_cents) })}
                {a.kind === "unbacked" && t("alert.unbacked", { name: a.name.replace(/^SAMPLE\s+/, ""), amount: formatCents(a.unbacked_cents) })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold text-ink">{t("recent")}</h2>
          <Link href={`/account/build-account/statement${qs(selected)}`} className="text-sm font-bold text-forest">
            {t("seeStatement")} →
          </Link>
        </div>
        {view.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{t("nothingYet")}</p>
        ) : (
          <ul className="mt-2 divide-y divide-[#eef0ef]">
            {M.statement(view)
              .slice(0, 5)
              .map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-ink">{(e.description || e.shop).replace(/^SAMPLE\s+/, "")}</span>
                    <span className="text-xs text-muted">
                      {fmtDate(e.occurred_on)} · {accountName(data, e.account_id)}
                      {e.status === "pending" && ` · ${t("onItsWay")}`}
                    </span>
                  </span>
                  <span className={`shrink-0 font-extrabold ${e.direction === "in" ? "text-ok" : "text-ink"} ${e.status !== "confirmed" ? "opacity-60" : ""}`}>
                    {e.direction === "in" ? "+" : "−"}
                    {formatCents(e.amount_cents)}
                  </span>
                </li>
              ))}
          </ul>
        )}
      </section>
    </BaShell>
  );
}
