import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guard";
import { REQUEST_TIMELINE, timelineIndex, type RequestStatus } from "@/lib/status";
import { formatCents } from "@/lib/money";
import * as M from "@/lib/buildAccount/math";

const DONE = ["report_ready", "balance_paid", "done"];
const clean = (s: string | null | undefined) => (s ?? "").replace(/^SAMPLE\s*[—-]?\s*/, "");

/** Customer dashboard — part of the LBH website, real data only. */
export default async function AccountDashboard({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ welcome?: string }>;
}) {
  const { locale } = await params;
  const { welcome } = await searchParams;
  setRequestLocale(locale);
  const { supabase, user, profile } = await requireRole(locale, ["client"]);
  const t = await getTranslations("account.dashboard");
  const ts = await getTranslations("portal.status");
  const tn = await getTranslations("site.account");

  const [{ data: requests }, { data: approvals }, { data: entries }, { data: payments }, { data: reports }] = await Promise.all([
    supabase.from("service_requests").select("id, type, status, title, details, updated_at").order("updated_at", { ascending: false }),
    supabase.from("approvals").select("id, request_id, title, amount_cents, created_at").eq("status", "pending").order("created_at", { ascending: false }),
    supabase.from("ba_entries").select("direction, status, amount_cents").eq("owner_id", user.id),
    supabase.from("payments").select("id, request_id, amount_cents, kind, confirmed_at, service_requests(title)").eq("status", "confirmed").order("confirmed_at", { ascending: false }).limit(4),
    supabase.from("reports").select("id, request_id, published_at, service_requests(title)").eq("status", "published").order("published_at", { ascending: false }).limit(4),
  ]);

  const all = requests ?? [];
  const active = all.filter((r) => !DONE.includes(r.status) && r.status !== "cancelled");
  const ba = (entries ?? []) as M.BaEntry[];
  const name = clean(profile.full_name || profile.email).split(" ")[0];
  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString(locale === "en" ? "en-GB" : locale, { day: "numeric", month: "short" });

  // Recent updates: genuine events only (payments confirmed, reports published, approvals requested)
  type Ev = { at: string; text: string; href: string; tone: "action" | "info" };
  const events: Ev[] = [
    ...(approvals ?? []).map((a) => ({ at: a.created_at as string, text: t("ev.approval", { title: clean(a.title) }), href: `/portal/requests/${a.request_id}#approvals`, tone: "action" as const })),
    ...(reports ?? []).filter((r) => r.published_at).map((r) => ({
      at: r.published_at as string,
      text: t("ev.report", { title: clean((r.service_requests as unknown as { title: string } | null)?.title) }),
      href: `/portal/requests/${r.request_id}/report`,
      tone: "info" as const,
    })),
    ...(payments ?? []).filter((p) => p.confirmed_at).map((p) => ({
      at: p.confirmed_at as string,
      text: t("ev.payment", { amount: formatCents(p.amount_cents), title: clean((p.service_requests as unknown as { title: string } | null)?.title) }),
      href: `/portal/requests/${p.request_id}#payments`,
      tone: "info" as const,
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 5);

  return (
    <div data-testid="account-dashboard">
      {/* heading */}
      <header className="flex flex-col gap-4 border-b border-rule pb-8 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="ds-eyebrow">{tn("dashboard")}</p>
          <h1 className="ds-h2 mt-2">{t("hello", { name })}</h1>
          <p className="ds-body mt-2 max-w-xl">{t("intro")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/portal/requests/new-land" className="ds-btn ds-btn-primary min-h-11 px-4 text-sm">{t("newLand")}</Link>
          <Link href="/portal/requests/new-materials" className="ds-btn ds-btn-outline min-h-11 px-4 text-sm">{t("newMaterials")}</Link>
        </div>
      </header>

      {welcome === "1" && (
        <p role="status" className="mt-6 border-l-2 border-forest bg-paper px-4 py-3 text-sm">
          <strong className="font-semibold text-forest">{t("welcomeTitle", { name })}</strong> {t("welcomeText")}
        </p>
      )}

      {/* summary */}
      <dl className="grid grid-cols-3 divide-x divide-rule border-b border-rule">
        <div className="py-6 pr-3 md:py-8">
          <dt className="text-xs font-semibold tracking-wider text-slate uppercase">{t("active")}</dt>
          <dd className="mt-1 font-serif text-3xl md:text-4xl" data-testid="sum-active">{active.length}</dd>
        </div>
        <div className="px-3 py-6 md:px-6 md:py-8">
          <dt className="text-xs font-semibold tracking-wider text-slate uppercase">{t("waiting")}</dt>
          <dd className={`mt-1 font-serif text-3xl md:text-4xl ${approvals?.length ? "text-[#a0461a]" : ""}`} data-testid="sum-waiting">{approvals?.length ?? 0}</dd>
        </div>
        <div className="pl-3 py-6 md:pl-6 md:py-8">
          <dt className="text-xs font-semibold tracking-wider text-slate uppercase">{t("balance")}</dt>
          <dd className="mt-1 font-serif text-3xl md:text-4xl" data-testid="sum-balance">{formatCents(M.balance(ba))}</dd>
        </div>
      </dl>

      <div className="mt-10 grid gap-12 lg:grid-cols-12 lg:gap-10">
        <div className="space-y-12 lg:col-span-8">
          {/* attention */}
          {(approvals?.length ?? 0) > 0 && (
            <section aria-labelledby="attention" className="border-l-2 border-[#a0461a] bg-paper px-5 py-4" data-testid="attention">
              <h2 id="attention" className="text-sm font-semibold text-[#a0461a]">{t("attention", { count: approvals!.length })}</h2>
              <ul className="mt-2 space-y-1.5">
                {approvals!.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-2 text-[15px]">
                    <Link href={`/portal/requests/${a.request_id}#approvals`} className="ds-link">{clean(a.title)}</Link>
                    {a.amount_cents ? <span className="text-sm text-slate">{formatCents(a.amount_cents)}</span> : null}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* projects */}
          <section aria-labelledby="projects">
            <div className="flex items-baseline justify-between">
              <h2 id="projects" className="ds-h3">{tn("projects")}</h2>
              <span className="text-sm text-slate">{t("count", { count: all.length })}</span>
            </div>
            {all.length === 0 ? (
              <p className="ds-body mt-4">{t("noProjects")}</p>
            ) : (
              <ul className="mt-4 border-t border-rule" data-testid="project-list">
                {all.map((r) => {
                  const i = timelineIndex(r.status as RequestStatus);
                  const pct = r.status === "cancelled" ? 0 : Math.round(((i + 1) / REQUEST_TIMELINE.length) * 100);
                  const d = (r.details ?? {}) as { town?: string; stand_number?: string };
                  const where = [d.stand_number && `Stand ${d.stand_number}`, d.town].filter(Boolean).join(", ");
                  return (
                    <li key={r.id} className="border-b border-rule">
                      <Link href={r.type === "build" ? "/portal/build" : `/portal/requests/${r.id}`} className="group grid gap-3 py-5 md:grid-cols-12 md:items-center">
                        <div className="md:col-span-6">
                          <p className="text-xs font-semibold tracking-wider text-slate uppercase">{t(`type.${r.type}` as never)}</p>
                          <p className="mt-1 font-serif text-[1.15rem] text-charcoal group-hover:text-forest">{clean(r.title)}</p>
                          {where && <p className="text-sm text-slate">{clean(where)}</p>}
                        </div>
                        <div className="md:col-span-5">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-charcoal">{ts(r.status as never)}</span>
                            <span className="text-slate">{fmtDate(r.updated_at)}</span>
                          </div>
                          <div className="mt-2 h-1 bg-sand">
                            <div className="h-1 bg-forest" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                        <span aria-hidden className="hidden text-right text-forest md:col-span-1 md:block">→</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* updates */}
          <section aria-labelledby="updates">
            <h2 id="updates" className="ds-h3">{tn("updates")}</h2>
            {events.length === 0 ? (
              <p className="ds-body mt-4">{t("noUpdates")}</p>
            ) : (
              <ol className="mt-4 border-l border-rule" data-testid="updates">
                {events.map((e, i) => (
                  <li key={i} className="relative pb-5 pl-6 last:pb-0">
                    <span aria-hidden className={`absolute top-1.5 -left-[4px] h-2 w-2 rounded-full ${e.tone === "action" ? "bg-[#a0461a]" : "bg-forest"}`} />
                    <Link href={e.href} className="text-[15px] text-charcoal hover:text-forest">{e.text}</Link>
                    <p className="text-xs text-slate">{fmtDate(e.at)}</p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        {/* side column */}
        <aside className="space-y-10 lg:col-span-4">
          <section aria-labelledby="ba" className="bg-forest p-6 text-[#e8e4d8]">
            <h2 id="ba" className="ds-eyebrow text-[#c9bfa6]">{tn("buildAccount")}</h2>
            <p className="mt-3 text-sm text-[#c9c3b3]">{t("baBalance")}</p>
            <p className="font-serif text-4xl text-white">{formatCents(M.balance(ba))}</p>
            <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-white/15 pt-4 text-sm">
              <div>
                <dt className="text-[#c9c3b3]">{t("baIn")}</dt>
                <dd className="mt-0.5 font-medium text-white">{formatCents(M.moneyIn(ba))}</dd>
              </div>
              <div>
                <dt className="text-[#c9c3b3]">{t("baSpent")}</dt>
                <dd className="mt-0.5 font-medium text-white">{formatCents(M.spent(ba))}</dd>
              </div>
            </dl>
            {M.onItsWay(ba) > 0 && <p className="mt-3 text-xs text-[#c9c3b3]">{t("baOnWay", { amount: formatCents(M.onItsWay(ba)) })}</p>}
            <Link href="/portal/build-account" className="ds-btn ds-btn-light mt-6 w-full text-sm">{t("baOpen")}</Link>
          </section>

          <section aria-labelledby="shortcuts">
            <h2 id="shortcuts" className="ds-eyebrow">{t("shortcuts")}</h2>
            <ul className="mt-3 border-t border-rule text-[15px]">
              {[
                ["/portal/build", tn("progress")],
                ["/portal/build-account/statement", tn("finance")],
                ["/portal/build-account/statement?f=noreceipt", tn("documents")],
                ["/book-a-call", t("bookCall")],
              ].map(([href, label]) => (
                <li key={href} className="border-b border-rule">
                  <Link href={href} className="flex items-center justify-between py-3 text-charcoal hover:text-forest">
                    {label}
                    <span aria-hidden className="text-slate">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="help" className="border border-rule bg-paper p-5">
            <h2 id="help" className="font-serif text-lg">{t("helpTitle")}</h2>
            <p className="ds-body mt-1 text-sm">{t("helpText")}</p>
            <Link href="/portal/chat" className="ds-link mt-3 inline-block text-sm">{t("helpChat")}</Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
