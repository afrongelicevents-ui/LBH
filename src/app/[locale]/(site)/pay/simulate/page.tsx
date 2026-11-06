import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole } from "@/lib/auth/guard";
import { simulatedPaymentsEnabled } from "@/lib/paynow";
import { formatCents } from "@/lib/money";
import SimulateButtons from "@/components/portal/SimulateButtons";

/**
 * SIMULATED TEST CHECKOUT — only exists while Paynow credentials are not
 * configured. Clearly labelled; no real money moves here.
 */
export default async function SimulatePayPage({
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

  const { data: payment } = await supabase
    .from("payments")
    .select("id, kind, status, amount_cents, merchant_reference")
    .eq("merchant_reference", ref)
    .maybeSingle();
  if (!payment) notFound();

  return (
    <div className="mx-auto max-w-md space-y-4 py-8">
      <div className="rounded-2xl border-2 border-dashed border-gold bg-gold/10 p-4 text-center">
        <p className="text-sm font-extrabold tracking-wide text-forest uppercase">
          {t("testBanner")}
        </p>
        <p className="mt-1 text-xs text-muted">{t("testExplainer")}</p>
      </div>

      <div className="card p-6 text-center">
        <p className="text-sm text-muted">{t("youArePaying")}</p>
        <p className="headline mt-1 text-3xl text-forest">
          {formatCents(payment.amount_cents)}
        </p>
        <p className="mt-1 text-xs text-muted">{payment.merchant_reference}</p>

        {["pending", "failed"].includes(payment.status) ? (
          <SimulateButtons reference={payment.merchant_reference} />
        ) : (
          <p className="mt-4 text-sm font-bold text-forest">
            {t(`status.${payment.status}` as never)}
          </p>
        )}
      </div>
    </div>
  );
}
