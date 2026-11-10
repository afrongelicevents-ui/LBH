import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guard";
import { loadAccount } from "@/lib/account/data";
import { formatCents } from "@/lib/money";
import * as M from "@/lib/buildAccount/math";
import PageHead from "@/components/account/PageHead";

/** Financial overview — payments to LBH and the Build Account in one place. */
export default async function FinancePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase, user } = await requireRole(locale, ["client"]);
  const d = await loadAccount(supabase);
  if (d.counts.finance === 0) redirect({ href: "/account", locale });
  const t = await getTranslations("account.finance");
  const tn = await getTranslations("site.account");
  const tp = await getTranslations("account.documents");
  const { data: entries } = await supabase.from("ba_entries").select("direction, status, amount_cents").eq("owner_id", user.id);
  const ba = (entries ?? []) as M.BaEntry[];
  const pays = [...d.payments].sort((a, b) => (b.confirmed_at ?? b.created_at).localeCompare(a.confirmed_at ?? a.created_at));
  const paid = pays.filter((p) => p.status === "confirmed").reduce((s, p) => s + p.amount_cents, 0);
  const open = pays.filter((p) => p.status === "pending" || p.status === "submitted").reduce((s, p) => s + p.amount_cents, 0);
  const nameOf = (id: string) => (d.requests.find((r) => r.id === id)?.title ?? "").replace(/^SAMPLE\s*[—-]?\s*/, "");
  const fmt = (s: string) => new Date(s).toLocaleDateString(locale === "en" ? "en-GB" : locale, { day: "numeric", month: "short", year: "numeric" });
  return (
    <div data-testid="finance-page">
      <PageHead eyebrow={tn("finance")} title={t("title")} intro={t("intro")} />
      <dl className="grid grid-cols-2 border-b border-rule md:grid-cols-4 md:divide-x md:divide-rule">
        {[
          [t("paidToLbh"), formatCents(paid)],
          [t("awaiting"), formatCents(open)],
          [t("baBalance"), formatCents(M.balance(ba))],
          [t("baSpent"), formatCents(M.spent(ba))],
        ].map(([label, value], i) => (
          <div key={label} className={`py-5 pr-3 md:py-6 ${i ? "md:pl-6" : ""}`}>
            <dt className="text-xs font-semibold tracking-wider text-slate uppercase">{label}</dt>
            <dd className="mt-1 font-serif text-2xl md:text-3xl">{value}</dd>
          </div>
        ))}
      </dl>
      <section className="mt-10" aria-labelledby="payments">
        <div className="flex items-baseline justify-between">
          <h2 id="payments" className="ds-h3">{t("payments")}</h2>
          <Link href="/account/documents?k=invoice" className="ds-link text-sm">{tp("kind.invoice")}</Link>
        </div>
        <ul className="mt-3 border-t border-rule">
          {pays.map((p) => (
            <li key={p.id} className="grid grid-cols-12 items-center gap-2 border-b border-rule py-3.5 text-[15px]">
              <span className="col-span-7 md:col-span-6">
                <span className="block text-charcoal">{t(`kind.${p.kind}` as never)}</span>
                <span className="block text-sm text-slate">{nameOf(p.request_id)}</span>
              </span>
              <span className="col-span-5 text-right font-medium md:col-span-2 md:text-left">{formatCents(p.amount_cents)}</span>
              <span className="col-span-12 text-sm md:col-span-4 md:text-right">
                <span className={`ds-tag ${p.status === "confirmed" ? "ds-tag-green" : ""}`}>{t(`status.${p.status}` as never)}</span>
                <span className="ml-2 text-xs text-slate">{fmt(p.confirmed_at ?? p.created_at)}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section className="mt-10 bg-forest p-6 text-[#e8e4d8] md:flex md:items-center md:justify-between" aria-label={tn("buildAccount")}>
        <p className="max-w-xl text-sm">{t("baText")}</p>
        <Link href="/account/build-account/statement" className="ds-btn ds-btn-light mt-4 text-sm md:mt-0">{t("baOpen")}</Link>
      </section>
    </div>
  );
}
