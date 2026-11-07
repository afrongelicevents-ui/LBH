import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole } from "@/lib/auth/guard";
import { toneFor } from "@/lib/tones";
import { formatCents } from "@/lib/money";
import { ConfirmPaymentButton } from "@/components/admin/AdminActions";

export default async function AdminPaymentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, ["admin"]);
  const t = await getTranslations("admin.payments");

  const { data: payments } = await supabase
    .from("payments")
    .select("*, service_requests(title)")
    .order("created_at", { ascending: false })
    .limit(300);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="section-title text-2xl">{t("title")}</h1>
        {/* API download, not a page navigation */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/api/admin/payments-csv" className="btn btn-outline-green min-h-10 px-4 text-xs">
          {t("exportCsv")}
        </a>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted uppercase">
              <th className="px-4 py-3">{t("request")}</th>
              <th className="px-4 py-3">{t("kind")}</th>
              <th className="px-4 py-3">{t("amount")}</th>
              <th className="px-4 py-3">{t("method")}</th>
              <th className="px-4 py-3">{t("status")}</th>
              <th className="px-4 py-3">{t("reference")}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {(payments ?? []).map((p) => (
              <tr key={p.id} className="border-b border-line last:border-0">
                <td className="px-4 py-2.5 font-semibold text-ink">
                  {(p.service_requests as unknown as { title: string })?.title}
                </td>
                <td className="px-4 py-2.5 text-muted">{p.kind}</td>
                <td className="px-4 py-2.5 font-bold text-forest">
                  {formatCents(p.amount_cents)}
                </td>
                <td className="px-4 py-2.5 text-muted">{p.method}</td>
                <td className="px-4 py-2.5">
                  <span className={`badge badge-dot badge-${toneFor(p.status)}`}>{p.status}</span>
                </td>
                <td className="px-4 py-2.5 text-xs text-muted">{p.merchant_reference}</td>
                <td className="px-4 py-2.5">
                  {p.status === "submitted" && <ConfirmPaymentButton paymentId={p.id} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
