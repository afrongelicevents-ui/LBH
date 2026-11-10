import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guard";
import { loadAccount } from "@/lib/account/data";
import { signedUrl } from "@/lib/uploads";
import PageHead from "@/components/account/PageHead";

const KINDS = ["quote", "invoice", "report", "receipt", "document"] as const;

/** Receipts & documents — quotes, invoices, report PDFs, uploaded documents and receipts. */
export default async function DocumentsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ k?: string }> }) {
  const { locale } = await params;
  const { k } = await searchParams;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, ["client"]);
  const d = await loadAccount(supabase);
  if (d.documents.length === 0) redirect({ href: "/account", locale });
  const t = await getTranslations("account.documents");
  const tn = await getTranslations("site.account");
  const filter = KINDS.includes(k as (typeof KINDS)[number]) ? k : null;
  const shown = d.documents.filter((x) => !filter || x.kind === filter).slice(0, 200);
  // private files open through short-lived signed links
  const items = (
    await Promise.all(shown.map(async (x) => ({ ...x, url: x.storage ? (await signedUrl(x.storage.bucket, x.storage.path, 600).catch(() => null)) ?? "" : x.href })))
  ).filter((x) => x.url); // a file that can't be opened is not listed
  const fmt = (s: string) => (s ? new Date(s).toLocaleDateString(locale === "en" ? "en-GB" : locale, { day: "numeric", month: "short", year: "numeric" }) : "");
  const present = KINDS.filter((kind) => d.documents.some((x) => x.kind === kind));
  return (
    <div data-testid="documents-page">
      <PageHead eyebrow={tn("documents")} title={t("title")} intro={t("intro")} />
      {present.length > 1 && (
        <nav aria-label={t("filter")} className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <a href="?" className={!filter ? "font-semibold text-forest underline underline-offset-4" : "text-charcoal hover:text-forest"}>{t("all")}</a>
          {present.map((kind) => (
            <a key={kind} href={`?k=${kind}`} className={filter === kind ? "font-semibold text-forest underline underline-offset-4" : "text-charcoal hover:text-forest"}>{t(`kind.${kind}`)}</a>
          ))}
        </nav>
      )}
      <ul className="mt-4 border-t border-rule">
        {items.map((x, i) => (
          <li key={i} className="grid gap-1 border-b border-rule py-4 md:grid-cols-12 md:items-center" data-testid="doc-row">
            <span className="text-xs font-semibold tracking-wider text-slate uppercase md:col-span-2">{t(`kind.${x.kind}`)}</span>
            <span className="md:col-span-6">
              <span className="block text-[15px] text-charcoal">{x.title || t(`kind.${x.kind}`)}</span>
              <span className="block text-sm text-slate">{x.project}</span>
            </span>
            <span className="text-sm text-slate md:col-span-2">{fmt(x.at)}</span>
            <span className="md:col-span-2 md:text-right">
              {x.url ? <a href={x.url} target="_blank" rel="noopener noreferrer" className="ds-link text-sm">{t("open")}</a> : null}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm text-slate">{t("baNote")}</p>
    </div>
  );
}
