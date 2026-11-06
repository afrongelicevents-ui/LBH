import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guard";
import { formatCents, depositSplit } from "@/lib/money";
import { signedUrl } from "@/lib/uploads";
import { paynowConfigured, simulatedPaymentsEnabled } from "@/lib/paynow";
import type { RequestStatus } from "@/lib/status";
import StatusTimeline from "@/components/portal/StatusTimeline";
import {
  AcceptQuoteButton,
  ApprovalButtons,
  SupplierQuoteApprove,
  PayButton,
  ManualProofForm,
} from "@/components/portal/RequestActions";

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, ["client"]);
  const t = await getTranslations("portal.request");

  const { data: req } = await supabase
    .from("service_requests")
    .select("id, type, status, title, details, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!req) notFound();

  const [
    { data: documents },
    { data: quotes },
    { data: payments },
    { data: approvals },
    { data: supplierQuotes },
    { data: report },
    { data: receipts },
    { data: invoices },
  ] = await Promise.all([
    supabase.from("documents").select("*").eq("request_id", id).order("created_at"),
    supabase
      .from("quotes")
      .select("*, quote_lines(*)")
      .eq("request_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("payments").select("*").eq("request_id", id).order("created_at"),
    supabase.from("approvals").select("*").eq("request_id", id).order("created_at"),
    supabase.from("supplier_quotes").select("*").eq("request_id", id).order("amount_cents"),
    supabase
      .from("reports")
      .select("id, status, verdict, published_at")
      .eq("request_id", id)
      .eq("status", "published")
      .maybeSingle(),
    supabase
      .from("media")
      .select("id, kind, storage_path, amount_cents, note, taken_at, original_name")
      .eq("request_id", id)
      .eq("kind", "receipt")
      .order("created_at"),
    supabase.from("invoices").select("*").eq("request_id", id).order("issued_at"),
  ]);

  const onlinePayments = paynowConfigured() || simulatedPaymentsEnabled();
  const details = (req.details ?? {}) as Record<string, unknown>;
  const items = Array.isArray(details.items)
    ? (details.items as { item: string; quantity: string; notes?: string }[])
    : [];

  const docLinks = await Promise.all(
    (documents ?? []).map(async (d) => ({
      ...d,
      url: await signedUrl("documents", d.storage_path),
    }))
  );
  const receiptLinks = await Promise.all(
    (receipts ?? []).map(async (m) => ({
      ...m,
      url: await signedUrl("media", m.storage_path),
    }))
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/portal" className="text-xs font-semibold text-muted hover:text-forest">
          ← {t("back")}
        </Link>
        <h1 className="headline mt-1 text-2xl text-forest">{req.title}</h1>
        <div className="mt-3">
          <StatusTimeline status={req.status as RequestStatus} />
        </div>
      </div>

      {/* ---- details ---- */}
      <section className="card p-5">
        <h2 className="text-base font-bold text-forest">{t("detailsTitle")}</h2>
        {req.type === "land_verification" ? (
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-semibold text-muted">{t("town")}</dt>
              <dd className="text-ink">{String(details.town ?? "—")}</dd>
            </div>
            <div>
              <dt className="font-semibold text-muted">{t("standNumber")}</dt>
              <dd className="text-ink">{String(details.stand_number ?? "—")}</dd>
            </div>
            {typeof details.pin_lat === "number" && typeof details.pin_lng === "number" && (
              <div className="sm:col-span-2">
                <dt className="font-semibold text-muted">{t("mapPin")}</dt>
                <dd className="text-ink">
                  {Number(details.pin_lat).toFixed(5)}, {Number(details.pin_lng).toFixed(5)}
                </dd>
              </div>
            )}
          </dl>
        ) : (
          <div className="mt-3 text-sm">
            <p className="text-ink">
              <span className="font-semibold text-muted">{t("siteAddress")}: </span>
              {String(details.site_address ?? "—")}
            </p>
            {items.length > 0 && (
              <ul className="mt-2 list-inside list-disc space-y-1 text-ink">
                {items.map((it, i) => (
                  <li key={i}>
                    {it.item} — {it.quantity}
                    {it.notes ? ` (${it.notes})` : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {docLinks.length > 0 && (
          <>
            <h3 className="mt-4 text-sm font-bold text-forest">{t("documents")}</h3>
            <ul className="mt-1.5 space-y-1 text-sm">
              {docLinks.map((d) => (
                <li key={d.id}>
                  {d.url ? (
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-forest underline underline-offset-2"
                    >
                      {d.file_name}
                    </a>
                  ) : (
                    <span className="text-muted">{d.file_name}</span>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* ---- quote ---- */}
      {(quotes ?? [])
        .filter((q) => q.status !== "draft")
        .map((q) => {
          const split = depositSplit(q.total_cents, q.deposit_pct);
          return (
            <section key={q.id} className="card p-5" id="quote">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-bold text-forest">
                  {t("quoteTitle", { number: q.quote_number })}
                </h2>
                <a
                  href={`/api/pdf/quote/${q.id}`}
                  className="text-xs font-semibold text-forest underline underline-offset-2"
                >
                  {t("downloadPdf")}
                </a>
              </div>
              <table className="mt-3 w-full text-sm">
                <tbody>
                  {(q.quote_lines ?? [])
                    .sort((a: { position: number }, b: { position: number }) => a.position - b.position)
                    .map(
                      (line: {
                        id: string;
                        description: string;
                        total_cents: number;
                      }) => (
                        <tr key={line.id} className="border-b border-line last:border-0">
                          <td className="py-2 pr-2 text-ink">{line.description}</td>
                          <td className="py-2 text-right font-semibold whitespace-nowrap text-ink">
                            {formatCents(line.total_cents)}
                          </td>
                        </tr>
                      )
                    )}
                  <tr>
                    <td className="py-2 pr-2 font-bold text-forest">{t("total")}</td>
                    <td className="py-2 text-right font-bold whitespace-nowrap text-forest">
                      {formatCents(q.total_cents)}
                    </td>
                  </tr>
                  <tr className="text-xs text-muted">
                    <td className="pr-2">
                      {t("depositLine", { pct: q.deposit_pct })} · {t("balanceLine")}
                    </td>
                    <td className="text-right whitespace-nowrap">
                      {formatCents(split.deposit)} · {formatCents(split.balance)}
                    </td>
                  </tr>
                </tbody>
              </table>
              {q.notes && <p className="mt-2 text-xs text-muted">{q.notes}</p>}

              {q.status === "sent" && (
                <div className="mt-4">
                  <AcceptQuoteButton quoteId={q.id} />
                </div>
              )}
              {q.status === "accepted" && (
                <p className="mt-3 text-xs font-semibold text-forest">
                  {t("acceptedBy", {
                    name: q.accepted_by_name ?? "",
                    date: q.accepted_at ? new Date(q.accepted_at).toLocaleString() : "",
                  })}
                </p>
              )}
            </section>
          );
        })}

      {/* ---- payments ---- */}
      {(payments ?? []).length > 0 && (
        <section className="card p-5" id="payments">
          <h2 className="text-base font-bold text-forest">{t("paymentsTitle")}</h2>
          <ul className="mt-3 space-y-4">
            {(payments ?? []).map((p) => (
              <li key={p.id} className="rounded-xl border border-line p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-bold text-ink">
                    {t(`paymentKind.${p.kind}` as never)} · {formatCents(p.amount_cents)}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                      p.status === "confirmed"
                        ? "bg-forest text-white"
                        : p.status === "submitted"
                          ? "bg-gold text-forest"
                          : p.status === "failed"
                            ? "bg-red-100 text-red-800"
                            : "bg-line text-muted"
                    }`}
                  >
                    {t(`paymentStatus.${p.status}` as never)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted">{p.merchant_reference}</p>
                {["pending", "failed"].includes(p.status) && (
                  <div className="mt-3 flex flex-wrap items-start gap-3">
                    {onlinePayments && <PayButton paymentId={p.id} />}
                    <ManualProofForm paymentId={p.id} />
                  </div>
                )}
              </li>
            ))}
          </ul>
          {(invoices ?? []).length > 0 && (
            <ul className="mt-3 space-y-1 text-xs">
              {(invoices ?? []).map((inv) => (
                <li key={inv.id}>
                  <a
                    href={`/api/pdf/invoice/${inv.id}`}
                    className="font-semibold text-forest underline underline-offset-2"
                  >
                    {t("invoiceLink", { number: inv.invoice_number })}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ---- approvals: nothing proceeds until approved (brief §5.2) ---- */}
      {(approvals ?? []).length > 0 && (
        <section className="card p-5" id="approvals">
          <h2 className="text-base font-bold text-forest">{t("approvalsTitle")}</h2>
          <p className="mt-1 text-xs text-muted">{t("approvalsHint")}</p>
          <ul className="mt-3 space-y-4">
            {(approvals ?? []).map((a) => (
              <li
                key={a.id}
                className={`rounded-xl border p-4 ${
                  a.status === "pending" ? "border-gold bg-gold/5" : "border-line"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-bold text-ink">{a.title}</p>
                  <span className="text-sm font-bold text-forest">
                    {formatCents(a.amount_cents)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted">{a.reason}</p>
                {a.field_note && (
                  <p className="mt-1 text-xs text-muted italic">
                    {t("fieldNote")}: {a.field_note}
                  </p>
                )}
                <div className="mt-3">
                  {a.status === "pending" ? (
                    <ApprovalButtons approvalId={a.id} />
                  ) : (
                    <span
                      className={`text-xs font-bold ${
                        a.status === "approved" ? "text-forest" : "text-red-700"
                      }`}
                    >
                      {t(`approvalStatus.${a.status}` as never)}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---- supplier quotes (materials) ---- */}
      {(supplierQuotes ?? []).length > 0 && (
        <section className="card p-5" id="suppliers">
          <h2 className="text-base font-bold text-forest">{t("suppliersTitle")}</h2>
          <p className="mt-1 text-xs text-muted">{t("suppliersHint")}</p>
          <ul className="mt-3 space-y-3">
            {(supplierQuotes ?? []).map((sq) => (
              <li
                key={sq.id}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${
                  sq.status === "approved" ? "border-forest bg-forest/5" : "border-line"
                }`}
              >
                <div>
                  <p className="text-sm font-bold text-ink">{sq.supplier_name}</p>
                  <p className="text-xs text-muted">{sq.details}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-forest">
                    {formatCents(sq.amount_cents)}
                  </span>
                  {sq.status === "pending" &&
                    !(supplierQuotes ?? []).some((x) => x.status === "approved") && (
                      <SupplierQuoteApprove id={sq.id} />
                    )}
                  {sq.status === "approved" && (
                    <span className="rounded-full bg-forest px-2.5 py-0.5 text-[11px] font-bold text-white">
                      {t("supplierApproved")}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---- receipts ---- */}
      {receiptLinks.length > 0 && (
        <section className="card p-5">
          <h2 className="text-base font-bold text-forest">{t("receiptsTitle")}</h2>
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {receiptLinks.map((r) => (
              <li key={r.id} className="text-xs">
                {r.url ? (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-xl border border-line p-3 font-semibold text-forest hover:border-forest"
                  >
                    {r.note || r.original_name || t("receipt")}
                    {typeof r.amount_cents === "number" && (
                      <span className="mt-1 block text-ink">
                        {formatCents(r.amount_cents)}
                      </span>
                    )}
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---- report ---- */}
      {report && (
        <section className="card border-2 border-gold p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-forest">{t("reportReady")}</h2>
              <p className="text-xs text-muted">
                {report.published_at
                  ? new Date(report.published_at).toLocaleDateString()
                  : ""}
              </p>
            </div>
            <Link href={`/portal/requests/${req.id}/report`} className="btn btn-gold text-sm">
              {t("readReport")}
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
