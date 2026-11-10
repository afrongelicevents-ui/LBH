import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guard";
import { loadAccount } from "@/lib/account/data";
import { formatCents } from "@/lib/money";
import PageHead from "@/components/account/PageHead";

/** Updates — genuine events on the customer's projects (no push notifications). */
export default async function UpdatesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, ["client"]);
  const d = await loadAccount(supabase);
  if (d.updates.length === 0) redirect({ href: "/account", locale });
  const t = await getTranslations("account.updates");
  const tn = await getTranslations("site.account");
  const fmt = (s: string) => new Date(s).toLocaleDateString(locale === "en" ? "en-GB" : locale, { day: "numeric", month: "short", year: "numeric" });
  return (
    <div data-testid="updates-page">
      <PageHead eyebrow={tn("updates")} title={t("title")} intro={t("intro")} />
      <ol className="mt-8 max-w-3xl border-l border-rule">
        {d.updates.slice(0, 80).map((u, i) => (
          <li key={i} className="relative pb-6 pl-6 last:pb-0" data-kind={u.kind}>
            <span aria-hidden className={`absolute top-1.5 -left-[4px] h-2 w-2 rounded-full ${u.kind === "action" ? "bg-[#a0461a]" : "bg-forest"}`} />
            <Link href={u.href} className="text-[15px] text-charcoal hover:text-forest">
              {t(`ev.${u.text}` as "ev.payment", { ...u.params, amount: u.params.amount_cents ? formatCents(Number(u.params.amount_cents)) : "" } as never)}
            </Link>
            <p className="text-xs text-slate">{fmt(u.at)}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
