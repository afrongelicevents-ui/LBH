import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guard";
import { formatCents } from "@/lib/money";
import { planOf, type Plan, type PlanInput } from "@/lib/buildAccount/plan";
import { StatTiles, StatusBadge } from "@/components/ui/Portal";
import { CardIcon, UsersIcon, BellIcon } from "@/components/ui/PortalIcons";
import { BaSettingsForm, OverrideControl, LbhTransferButtons, RemindersButton } from "@/components/admin/BaAdmin";

const clean = (s: string | null | undefined) => (s ?? "").replace(/^SAMPLE\s+/, "");
const tone: Record<Plan, "ok" | "prog" | "done" | "grey"> = { free: "ok", paid: "prog", expired: "done", none: "grey" };

/** Admin → Settings → Build Account: prices, plan on/off, subscribers + overrides, money sent to LBH. */
export default async function AdminBuildAccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ show?: string }>;
}) {
  const { locale } = await params;
  const { show } = await searchParams;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, ["admin"]);
  const t = await getTranslations("admin.ba");

  const [settings, clients, subs, builds, pending, lbhAccounts, used] = await Promise.all([
    supabase.from("settings").select("build_account_enabled, build_account_monthly_cents, build_account_yearly_cents").eq("id", 1).single(),
    supabase.from("profiles").select("id, full_name, email").eq("role", "client").order("full_name").limit(2000),
    supabase.from("ba_subscriptions").select("owner_id, override, override_until, paid_until, plan"),
    supabase.from("service_requests").select("client_id").eq("type", "build").neq("status", "cancelled"),
    supabase
      .from("ba_entries")
      .select("id, owner_id, account_id, amount_cents, fee_cents, service, occurred_on, description")
      .eq("direction", "in")
      .eq("status", "pending")
      .order("occurred_on"),
    supabase.from("ba_accounts").select("id, owner_id").eq("kind", "lbh"),
    supabase.from("ba_accounts").select("owner_id"),
  ]);

  const subBy = new Map((subs.data ?? []).map((s) => [s.owner_id as string, s]));
  const buildSet = new Set((builds.data ?? []).map((b) => b.client_id as string));
  const usedSet = new Set((used.data ?? []).map((a) => a.owner_id as string));
  const lbhIds = new Set((lbhAccounts.data ?? []).map((a) => a.id as string));
  const nameOf = new Map((clients.data ?? []).map((c) => [c.id as string, clean(c.full_name) || c.email]));

  const rows = (clients.data ?? []).map((c) => {
    const s = subBy.get(c.id);
    const plan = planOf((s as PlanInput | undefined) ?? null, buildSet.has(c.id));
    return { ...c, plan, sub: s, hasBuild: buildSet.has(c.id), uses: usedSet.has(c.id) };
  });
  const count = (p: Plan) => rows.filter((r) => r.plan === p).length;
  const listed = show === "all" ? rows : rows.filter((r) => r.plan !== "none" || r.uses || r.sub);
  const toLbh = (pending.data ?? []).filter((e) => lbhIds.has(e.account_id));

  return (
    <div className="mx-auto max-w-4xl space-y-4" data-testid="admin-ba">
      <div>
        <Link href="/admin/settings" className="text-xs font-semibold text-muted hover:text-forest">
          ← {t("backToSettings")}
        </Link>
        <h1 className="section-title mt-1 text-2xl">
          <CardIcon size={22} className="text-forest" />
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-muted">{t("intro")}</p>
      </div>

      <StatTiles
        tiles={[
          { label: t("plan.free"), value: String(count("free")), icon: <UsersIcon size={20} />, tone: "ok" },
          { label: t("plan.paid"), value: String(count("paid")), icon: <CardIcon size={20} />, tone: "prog" },
          { label: t("plan.expired"), value: String(count("expired")), icon: <BellIcon size={20} />, tone: "done" },
        ]}
      />

      {settings.data && (
        <BaSettingsForm
          enabled={settings.data.build_account_enabled}
          monthly={settings.data.build_account_monthly_cents}
          yearly={settings.data.build_account_yearly_cents}
        />
      )}

      <section className="card p-5" data-testid="admin-ba-transfers">
        <h2 className="text-base font-extrabold text-ink">{t("transfersTitle")}</h2>
        <p className="mt-1 text-xs text-muted">{t("transfersHint")}</p>
        {toLbh.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{t("noTransfers")}</p>
        ) : (
          <ul className="mt-2 divide-y divide-[#eef0ef]">
            {toLbh.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span>
                  <strong>{formatCents(e.amount_cents)}</strong> · {nameOf.get(e.owner_id) ?? ""}
                  <span className="text-muted">
                    {" "}
                    · {e.service ?? ""} · {e.occurred_on}
                  </span>
                </span>
                <LbhTransferButtons entryId={e.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-5" data-testid="admin-ba-subscribers">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-extrabold text-ink">{t("subscribersTitle")}</h2>
          <RemindersButton />
        </div>
        <p className="mt-1 text-xs text-muted">{t("subscribersHint")}</p>
        <Link href={show === "all" ? "/admin/settings/build-account" : "/admin/settings/build-account?show=all"} className="mt-2 inline-block text-xs font-bold text-forest">
          {show === "all" ? t("showUsing") : t("showAll")}
        </Link>
        {listed.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{t("noSubscribers")}</p>
        ) : (
          <ul className="mt-2 divide-y divide-[#eef0ef]">
            {listed.map((r) => (
              <li key={r.id} className="space-y-2 py-3" data-testid={`sub-${r.id}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block font-bold text-ink">{clean(r.full_name) || r.email}</span>
                    <span className="block text-xs text-muted">
                      {r.email}
                      {r.hasBuild && ` · ${t("hasBuild")}`}
                      {r.sub?.paid_until && ` · ${t("paidUntil", { date: String(r.sub.paid_until).slice(0, 10) })}`}
                      {r.sub?.override && ` · ${t("overridden")}`}
                    </span>
                  </span>
                  <StatusBadge tone={tone[r.plan]}>{t(`plan.${r.plan}`)}</StatusBadge>
                </div>
                <OverrideControl ownerId={r.id} current={(r.sub?.override as string | null) ?? null} until={(r.sub?.override_until as string | null) ?? null} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
