import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guard";
import { loadAccount, type ApprovalItem } from "@/lib/account/data";
import { formatCents } from "@/lib/money";
import PageHead from "@/components/account/PageHead";

/** Approvals — what is waiting for the customer, and what they decided. */
export default async function ApprovalsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, ["client"]);
  const d = await loadAccount(supabase);
  if (d.counts.approvals === 0) redirect({ href: "/account", locale });
  const t = await getTranslations("account.approvals");
  const tn = await getTranslations("site.account");
  const fmt = (s: string) => (s ? new Date(s).toLocaleDateString(locale === "en" ? "en-GB" : locale, { day: "numeric", month: "short", year: "numeric" }) : "");
  const Row = ({ a, done }: { a: ApprovalItem; done?: boolean }) => (
    <li className="border-b border-rule">
      <Link href={a.href} className="group grid gap-1 py-4 md:grid-cols-12 md:items-center">
        <span className="md:col-span-7">
          <span className="block text-xs font-semibold tracking-wider text-slate uppercase">{t(`kind.${a.kind}`)}</span>
          <span className="block font-serif text-[1.1rem] text-charcoal group-hover:text-forest">{a.title}</span>
          <span className="block text-sm text-slate">{a.project}</span>
        </span>
        <span className="text-sm text-charcoal md:col-span-2">{a.amount_cents ? formatCents(a.amount_cents) : ""}</span>
        <span className="text-sm md:col-span-3 md:text-right">
          {done ? <span className="ds-tag ds-tag-green">{t(`decided.${a.decided}`)}</span> : <span className="ds-link">{t("open")}</span>}
          <span className="ml-2 text-xs text-slate">{fmt(a.at)}</span>
        </span>
      </Link>
    </li>
  );
  return (
    <div data-testid="approvals-page">
      <PageHead eyebrow={tn("approvals")} title={t("title")} intro={t("intro")} />
      <section aria-labelledby="waiting" className="mt-8">
        <h2 id="waiting" className="ds-h3">{t("waiting", { count: d.pending.length })}</h2>
        {d.pending.length === 0 ? <p className="ds-body mt-3">{t("nothingWaiting")}</p> : <ul className="mt-3 border-t border-rule" data-testid="approvals-pending">{d.pending.map((a, i) => <Row key={i} a={a} />)}</ul>}
      </section>
      {d.history.length > 0 && (
        <section aria-labelledby="history" className="mt-12">
          <h2 id="history" className="ds-h3">{t("history")}</h2>
          <ul className="mt-3 border-t border-rule">{d.history.map((a, i) => <Row key={i} a={a} done />)}</ul>
        </section>
      )}
    </div>
  );
}
