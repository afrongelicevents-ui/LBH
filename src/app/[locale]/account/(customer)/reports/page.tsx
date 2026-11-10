import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guard";
import { loadAccount } from "@/lib/account/data";
import PageHead from "@/components/account/PageHead";

/** Reports — published field reports and stage inspections. */
export default async function ReportsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, ["client"]);
  const d = await loadAccount(supabase);
  if (d.reports.length === 0) redirect({ href: "/account", locale });
  const t = await getTranslations("account.reports");
  const tn = await getTranslations("site.account");
  const fmt = (s: string) => new Date(s).toLocaleDateString(locale === "en" ? "en-GB" : locale, { day: "numeric", month: "long", year: "numeric" });
  return (
    <div data-testid="reports-page">
      <PageHead eyebrow={tn("reports")} title={t("title")} intro={t("intro")} />
      <ul className="mt-2">
        {d.reports.map((r) => (
          <li key={r.id} className="border-b border-rule">
            <div className="grid gap-2 py-5 md:grid-cols-12 md:items-center">
              <div className="md:col-span-7">
                <p className="text-xs font-semibold tracking-wider text-slate uppercase">{t(`kind.${r.kind}`)}</p>
                <Link href={r.href} className="font-serif text-[1.15rem] text-charcoal hover:text-forest">{r.project}</Link>
                <p className="text-sm text-slate">{fmt(r.published_at)}</p>
              </div>
              <div className="md:col-span-2">{r.verdict && <span className="ds-tag">{t(`verdict.${r.verdict}`)}</span>}</div>
              <div className="flex gap-4 text-sm md:col-span-3 md:justify-end">
                <Link href={r.href} className="ds-link">{t("open")}</Link>
                {r.kind === "report" && <a href={`/api/pdf/report/${r.id}`} className="ds-link">PDF</a>}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
