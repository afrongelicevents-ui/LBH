import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guard";
import { paynowConfigured, pollPaynowStatus } from "@/lib/paynow";
import {
  confirmPaymentByReference,
  failPaymentByReference,
} from "@/lib/payments";
import { formatCents } from "@/lib/money";
import { CheckCircleIcon } from "@/components/icons";

/**
 * Return page after checkout. Never trusts the redirect itself: in live
 * mode it re-polls Paynow server-side before showing success (brief §10).
 */
export default async function PayReturnPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ ref?: string }>;
}) {
  const { locale } = await params;
  const { ref } = await searchParams;
  setRequestLocale(locale);
  if (!ref) notFound();

  const { supabase } = await requireRole(locale, ["client"]);
  const t = await getTranslations("pay");

  let { data: payment } = await supabase
    .from("payments")
    .select("id, kind, status, amount_cents, merchant_reference, request_id, paynow_poll_url")
    .eq("merchant_reference", ref)
    .maybeSingle();
  if (!payment) notFound();

  // Live mode: synchronise with Paynow before rendering.
  if (
    paynowConfigured() &&
    payment.status === "pending" &&
    payment.paynow_poll_url
  ) {
    try {
      const polled = await pollPaynowStatus(payment.paynow_poll_url);
      if (polled.hashValid && polled.status === "paid") {
        await confirmPaymentByReference(ref, {
          viaWebhook: false,
          paynowReference: polled.paynowReference,
        });
      } else if (
        polled.hashValid &&
        ["cancelled", "failed"].includes(polled.status)
      ) {
        await failPaymentByReference(ref, `paynow status: ${polled.status}`);
      }
      const { data: refreshed } = await supabase
        .from("payments")
        .select("id, kind, status, amount_cents, merchant_reference, request_id, paynow_poll_url")
        .eq("merchant_reference", ref)
        .maybeSingle();
      if (refreshed) payment = refreshed;
    } catch (e) {
      console.error(`[pay-return] poll failed: ${e instanceof Error ? e.message : e}`);
    }
  }

  const confirmed = payment.status === "confirmed";

  return (
    <div className="mx-auto max-w-md py-10">
      <div className="card p-8 text-center">
        {confirmed ? (
          <>
            <CheckCircleIcon width={56} height={56} className="mx-auto text-gold" />
            <h1 className="headline mt-3 text-2xl text-forest">{t("thanksTitle")}</h1>
            <p className="mt-2 text-sm text-muted">
              {t("thanksText", { amount: formatCents(payment.amount_cents) })}
            </p>
          </>
        ) : payment.status === "failed" ? (
          <>
            <h1 className="headline text-2xl text-red-700">{t("failedTitle")}</h1>
            <p className="mt-2 text-sm text-muted">{t("failedText")}</p>
          </>
        ) : (
          <>
            <h1 className="headline text-2xl text-forest">{t("processingTitle")}</h1>
            <p className="mt-2 text-sm text-muted">{t("processingText")}</p>
          </>
        )}
        <Link
          href={`/portal/requests/${payment.request_id}`}
          className="btn btn-gold mt-6 w-full"
        >
          {t("backToRequest")}
        </Link>
      </div>
    </div>
  );
}
