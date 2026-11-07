import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guard";
import { formatCents } from "@/lib/money";
import { signedUrl } from "@/lib/uploads";
import StatusTimeline from "@/components/portal/StatusTimeline";
import type { RequestStatus } from "@/lib/status";
import {
  QuoteBuilder,
  SendDraftQuoteButton,
  AssignStaffForm,
  ExtraCostControls,
  ReportReviewControls,
  ConfirmPaymentButton,
  RequestStatusButtons,
  SupplierQuoteForm,
} from "@/components/admin/AdminActions";

export default async function AdminRequestDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const { supabase, user } = await requireRole(locale, ["admin"]);
  const t = await getTranslations("admin.request");

  const { data: req } = await supabase
    .from("service_requests")
    .select("*, profiles:client_id(id, full_name, email, whatsapp, country)")
    .eq("id", id)
    .maybeSingle();
  if (!req) notFound();
  const client = req.profiles as unknown as {
    id: string;
    full_name: string;
    email: string;
    whatsapp: string | null;
    country: string | null;
  };

  const [
    { data: settings },
    { data: staff },
    { data: documents },
    { data: quotes },
    { data: payments },
    { data: jobs },
    { data: extraCosts },
    { data: reports },
    { data: supplierQuotes },
    { data: media },
  ] = await Promise.all([
    supabase.from("settings").select("*").eq("id", 1).single(),
    supabase.from("profiles").select("id, full_name").eq("role", "field"),
    supabase.from("documents").select("*").eq("request_id", id),
    supabase.from("quotes").select("*, quote_lines(*)").eq("request_id", id).order("created_at", { ascending: false }),
    supabase.from("payments").select("*").eq("request_id", id).order("created_at"),
    supabase.from("jobs").select("*, profiles:assigned_to(full_name)").eq("request_id", id),
    supabase.from("extra_cost_requests").select("*").eq("request_id", id).order("created_at", { ascending: false }),
    supabase.from("reports").select("*, profiles:author_id(full_name)").eq("request_id", id).order("created_at", { ascending: false }),
    supabase.from("supplier_quotes").select("*").eq("request_id", id).order("amount_cents"),
    supabase.from("media").select("*").eq("request_id", id).order("created_at"),
  ]);

  const docLinks = await Promise.all(
    (documents ?? []).map(async (d) => ({ ...d, url: await signedUrl("documents", d.storage_path) }))
  );
  const proofLinks = await Promise.all(
    (payments ?? [])
      .filter((p) => p.proof_path)
      .map(async (p) => [p.id, await signedUrl("proofs", p.proof_path!)] as const)
  );
  const proofMap = new Map(proofLinks);
  const mediaLinks = await Promise.all(
    (media ?? []).map(async (m) => ({ ...m, url: await signedUrl("media", m.storage_path) }))
  );

  const details = (req.details ?? {}) as Record<string, unknown>;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <Link href="/admin/requests" className="text-xs font-semibold text-muted hover:text-forest">
          ← {t("allRequests")}
        </Link>
        <h1 className="headline mt-1 text-2xl text-forest">{req.title}</h1>
        <p className="text-xs text-muted">
          {client.full_name} · {client.email}
          {client.whatsapp && ` · ${client.whatsapp}`}
          {client.country && ` · ${client.country}`}
        </p>
        <div className="mt-3">
          <StatusTimeline status={req.status as RequestStatus} />
        </div>
        {req.type === "build" && (
          <p className="mt-2">
            <Link href={`/admin/builds/${req.id}`} className="btn btn-primary min-h-9 px-4 text-xs">
              {t("openBuildStages")}
            </Link>
          </p>
        )}
        <div className="mt-3">
          <RequestStatusButtons requestId={req.id} />
        </div>
      </div>

      {/* details + documents */}
      <section className="card p-5">
        <h2 className="text-base font-bold text-forest">{t("details")}</h2>
        <pre className="mt-2 overflow-x-auto rounded-xl bg-offwhite p-3 text-xs whitespace-pre-wrap text-ink">
          {JSON.stringify(details, null, 2)}
        </pre>
        {docLinks.length > 0 && (
          <ul className="mt-2 space-y-1 text-sm">
            {docLinks.map((d) =>
              d.url ? (
                <li key={d.id}>
                  <a href={d.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-forest underline underline-offset-2">
                    {d.file_name}
                  </a>
                </li>
              ) : null
            )}
          </ul>
        )}
      </section>

      {/* quotes */}
      <section className="card p-5" id="quote">
        <h2 className="text-base font-bold text-forest">{t("quotes")}</h2>
        {(quotes ?? []).map((q) => (
          <div key={q.id} className="mt-3 rounded-xl border border-line p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-bold text-ink">
                #{q.quote_number} · {formatCents(q.total_cents)} · {q.status}
              </span>
              <span className="flex items-center gap-3">
                <a href={`/api/pdf/quote/${q.id}`} className="text-xs font-semibold text-forest underline">
                  PDF
                </a>
                {q.status === "draft" && <SendDraftQuoteButton quoteId={q.id} />}
              </span>
            </div>
            <ul className="mt-2 space-y-0.5 text-xs text-muted">
              {(q.quote_lines ?? []).map((l: { id: string; description: string; total_cents: number }) => (
                <li key={l.id}>
                  {l.description} — {formatCents(l.total_cents)}
                </li>
              ))}
            </ul>
            {q.accepted_by_name && (
              <p className="mt-1 text-xs font-semibold text-forest">
                {t("acceptedBy", { name: q.accepted_by_name })}
              </p>
            )}
          </div>
        ))}
        <div className="mt-4 border-t border-line pt-4">
          <h3 className="mb-2 text-sm font-bold text-forest">{t("newQuote")}</h3>
          <QuoteBuilder
            requestId={req.id}
            perKmRateCents={settings?.per_km_rate_cents ?? 50}
            defaultDepositPct={settings?.deposit_pct ?? 50}
          />
        </div>
      </section>

      {/* payments */}
      <section className="card p-5" id="payments">
        <h2 className="text-base font-bold text-forest">{t("payments")}</h2>
        {(payments ?? []).length === 0 && <p className="mt-2 text-xs text-muted">—</p>}
        <ul className="mt-2 space-y-3">
          {(payments ?? []).map((p) => (
            <li key={p.id} className="rounded-xl border border-line p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-ink">
                  {p.kind} · {formatCents(p.amount_cents)} · {p.method} ·{" "}
                  <span className={p.status === "confirmed" ? "text-forest" : "text-muted"}>
                    {p.status}
                  </span>
                </span>
                {p.status === "submitted" && <ConfirmPaymentButton paymentId={p.id} />}
              </div>
              <p className="mt-1 text-xs text-muted">
                {p.merchant_reference}
                {p.proof_reference && ` · ref: ${p.proof_reference}`}{" "}
                {proofMap.get(p.id) && (
                  <a
                    href={proofMap.get(p.id)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-forest underline"
                  >
                    {t("viewProof")}
                  </a>
                )}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* assignment */}
      <section className="card p-5">
        <h2 className="text-base font-bold text-forest">{t("fieldTeam")}</h2>
        {(jobs ?? []).map((j) => (
          <p key={j.id} className="mt-2 text-sm text-ink">
            {(j.profiles as unknown as { full_name: string })?.full_name} ·{" "}
            <span className="text-muted">{j.status}</span>
          </p>
        ))}
        <div className="mt-3">
          <AssignStaffForm requestId={req.id} staff={staff ?? []} />
        </div>
      </section>

      {/* extra costs */}
      <section className="card p-5" id="extras">
        <h2 className="text-base font-bold text-forest">{t("extraCosts")}</h2>
        {(extraCosts ?? []).length === 0 && <p className="mt-2 text-xs text-muted">—</p>}
        <ul className="mt-2 space-y-3">
          {(extraCosts ?? []).map((ec) => (
            <li key={ec.id} className="rounded-xl border border-line p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-ink">
                  {ec.title} · {formatCents(ec.amount_cents)} ·{" "}
                  <span className="text-muted">{ec.status}</span>
                </span>
                {ec.status === "pending" && <ExtraCostControls ecrId={ec.id} />}
              </div>
              <p className="mt-1 text-xs text-muted">{ec.reason}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* supplier quotes (materials) */}
      {req.type === "materials" && (
        <section className="card p-5">
          <h2 className="text-base font-bold text-forest">{t("supplierQuotes")}</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {(supplierQuotes ?? []).map((sq) => (
              <li key={sq.id} className="flex justify-between rounded-xl border border-line p-3">
                <span className="text-ink">
                  {sq.supplier_name} · {formatCents(sq.amount_cents)}
                </span>
                <span className="font-bold text-muted">{sq.status}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 border-t border-line pt-3">
            <SupplierQuoteForm requestId={req.id} />
          </div>
        </section>
      )}

      {/* reports — review & publish (no self sign-off, brief §8) */}
      <section className="card p-5" id="report">
        <h2 className="text-base font-bold text-forest">{t("reports")}</h2>
        {(reports ?? []).length === 0 && <p className="mt-2 text-xs text-muted">—</p>}
        {(reports ?? []).map((r) => {
          const sections = (r.sections ?? {}) as Record<string, string>;
          const author = (r.profiles as unknown as { full_name: string })?.full_name;
          return (
            <div key={r.id} className="mt-3 rounded-xl border border-line p-4">
              <p className="text-sm font-bold text-ink">
                {t("author")}: {author} · {r.status}
                {r.verdict && ` · ${r.verdict}`}
              </p>
              <dl className="mt-2 space-y-2 text-xs">
                {Object.entries(sections).map(([k, v]) =>
                  v ? (
                    <div key={k}>
                      <dt className="font-bold text-muted uppercase">{k.replaceAll("_", " ")}</dt>
                      <dd className="whitespace-pre-line text-ink">{v}</dd>
                    </div>
                  ) : null
                )}
              </dl>
              {["submitted", "changes_requested", "draft"].includes(r.status) && (
                <div className="mt-3 border-t border-line pt-3">
                  <ReportReviewControls reportId={r.id} canPublish={r.author_id !== user.id} />
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* media */}
      {mediaLinks.length > 0 && (
        <section className="card p-5">
          <h2 className="text-base font-bold text-forest">{t("media")}</h2>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {mediaLinks.map((m) =>
              m.url ? (
                <a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer" className="block">
                  {["photo", "receipt"].includes(m.kind) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.url} alt="" className="aspect-square w-full rounded-lg object-cover" />
                  ) : (
                    <span className="flex aspect-square items-center justify-center rounded-lg bg-forest text-[10px] font-bold text-white">
                      {m.kind}
                    </span>
                  )}
                  <span className="block truncate text-[10px] text-muted">
                    {m.kind}
                    {m.flagged_far && " ⚠"}
                    {typeof m.amount_cents === "number" && ` ${formatCents(m.amount_cents)}`}
                  </span>
                </a>
              ) : null
            )}
          </div>
        </section>
      )}
    </div>
  );
}
