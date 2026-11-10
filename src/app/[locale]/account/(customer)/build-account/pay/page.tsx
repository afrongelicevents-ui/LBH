import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole } from "@/lib/auth/guard";
import { simulatedPaymentsEnabled } from "@/lib/paynow";
import { formatCents } from "@/lib/money";
import { SimulateBaButtons } from "@/components/buildAccount/PlanButtons";

/** SIMULATED TEST CHECKOUT for a Build Account plan (no real money). */
export default async function BaPayPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ ref?: string }>;
}) {
  const { locale } = await params;
  const { ref } = await searchParams;
  setRequestLocale(locale);
  if (!simulatedPaymentsEnabled() || !ref) notFound();
  const { supabase } = await requireRole(locale, ["client"]);
  const t = await getTranslations("pay");
  const tb = await getTranslations("ba");
  const { data: pay } = await supabase.from("ba_payments").select("plan, amount_cents, status, merchant_reference").eq("merchant_reference", ref).maybeSingle();
  if (!pay) notFound();
  return (
    <div className="mx-auto max-w-md space-y-4 py-8">
      <div className="rounded-2xl border-2 border-dashed border-accent bg-info p-4 text-center text-ink">
        <p className="text-sm font-extrabold tracking-wide text-forest uppercase">{t("testBanner")}</p>
        <p className="mt-1 text-xs text-muted">{t("testExplainer")}</p>
      </div>
      <div className="card p-6 text-center">
        <p className="text-sm text-muted">{tb(`planLabel.${pay.plan}` as never)}</p>
        <p className="headline mt-1 text-3xl text-forest">{formatCents(pay.amount_cents)}</p>
        <p className="mt-1 text-xs text-muted">{pay.merchant_reference}</p>
        {["pending", "failed"].includes(pay.status) ? <SimulateBaButtons reference={pay.merchant_reference} /> : <p className="mt-4 text-sm font-bold text-forest">{tb(`payStatus.${pay.status}` as never)}</p>}
      </div>
    </div>
  );
}
