import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guard";
import { formatCents } from "@/lib/money";
import { signedUrl } from "@/lib/uploads";
import StatusTimeline from "@/components/portal/StatusTimeline";
import type { RequestStatus } from "@/lib/status";
import { LEGAL_ITEMS, readLegal } from "@/lib/legal";
import { toneFor } from "@/lib/tones";
import { StatusBadge } from "@/components/ui/Portal";
import { AttachQuoteFileForm } from "@/components/build/StageActions";
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
  const tl = await getTranslations("field.legal");
  const tf = await getTranslations("field");
  const tl2 = await getTranslations("labels");
  const tpr = await getTranslations("portal.request");
  const tbs = await getTranslations("build.paymentStatus");

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
    supabase.from("profiles").select("id, full_name, staff_kind").eq("role", "field").order("full_name"),
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

  const supplierFiles = new Map(
    await Promise.all(
      (supplierQuotes ?? [])
        .filter((sq) => sq.file_path)
        .map(async (sq) => [sq.id, await signedUrl("documents", sq.file_path as string)] as const)
    )
  );

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <Link href="/admin/requests" className="text-xs font-semibold text-muted hover:text-forest">
          ← {t("allRequests")}
        </Link>
        <h1 className="section-title mt-1 text-2xl">{req.title}</h1>
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
            <Link href={`/admin/builds/${req.id}`} className="btn btn-primary min-h-10 px-4 text-xs">
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
        <dl className="mt-2 space-y-1 text-sm">
          {Object.entries(details).map(([k, v]) =>
            v === null || v === "" ? null : (
              <div key={k} className="flex flex-wrap gap-x-2">
                <dt className="font-semibold text-muted">{k.replaceAll("_", " ")}:</dt>
                <dd className="text-ink">
                  {Array.isArray(v)
                    ? v
                        .map((it) =>
                          typeof it === "object" && it
                            ? Object.values(it as Record<string, unknown>).filter(Boolean).join(" — ")
                            : String(it)
                        )
                        .join("; ")
                    : typeof v === "object"
                      ? JSON.stringify(v)
                      : String(v)}
                </dd>
              </div>
            )
          )}
        </dl>
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
                #{q.quote_number} · {formatCents(q.total_cents)} · {tl2(`quote.${q.status}` as never)}
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
                  {tpr(`paymentKind.${p.kind}` as never)} · {formatCents(p.amount_cents)} · {tl2(`method.${p.method}` as never)} ·{" "}
                  <span className={p.status === "confirmed" ? "text-forest" : "text-muted"}>
                    {tbs(p.status as never)}
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
        {(jobs ?? []).map((j) => {
          const legal = j.job_type === "title_check" ? readLegal(j.visit) : null;
          return (
            <div key={j.id} className="mt-2 text-sm text-ink">
              <p>
                {(j.profiles as unknown as { full_name: string })?.full_name} ·{" "}
                <span className="text-muted">
                  {t(`jobTypes.${j.job_type}` as never)} · {tf(`jobStatus.${j.status}` as never)}
                  {j.due_date ? ` · ${t("dueOn", { date: j.due_date })}` : ""}
                </span>
              </p>
              {legal && (
                <div className="mt-1 rounded-xl border border-line p-3 text-xs">
                  <ul className="space-y-1">
                    {LEGAL_ITEMS.map((item) => {
                      const it = legal.items[item];
                      return (
                        <li key={item}>
                          <span className="font-semibold">{tl(`items.${item}`)}:</span>{" "}
                          <span className={it?.status === "problem" ? "font-bold text-red-700" : it?.status === "ok" ? "font-bold text-forest" : "text-muted"}>
                            {tl(`status.${it?.status ?? "pending"}`)}
                          </span>
                          {it?.note ? <span className="text-muted"> — {it.note}</span> : null}
                        </li>
                      );
                    })}
                  </ul>
                  {legal.findings && <p className="mt-2"><span className="font-semibold">{tl("findings")}:</span> {legal.findings}</p>}
                  {legal.verdict && <p className="mt-1"><span className="font-semibold">{tl("verdict")}:</span> {tf(`verdicts.${legal.verdict}`)}</p>}
                </div>
              )}
            </div>
          );
        })}
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
                  <span className="text-muted">{tf(`extraStatus.${ec.status}` as never)}</span>
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
              <li key={sq.id} className="rounded-xl border border-line p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-ink">
                    {sq.supplier_name} · {formatCents(sq.amount_cents)}
                  </span>
                  <StatusBadge tone={toneFor(sq.status)}>
                    {sq.status === "approved"
                      ? t("supplierChosen")
                      : sq.status === "rejected"
                        ? t("supplierNotChosen")
                        : t("supplierPending")}
                  </StatusBadge>
                </div>
                {supplierFiles.get(sq.id) && (
                  <a
                    href={supplierFiles.get(sq.id) ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-xs font-bold text-forest underline underline-offset-2"
                  >
                    {t("viewSupplierQuote")}
                  </a>
                )}
                <AttachQuoteFileForm kind="supplier" quoteId={sq.id} hasFile={Boolean(sq.file_path)} />
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
                {t("author")}: {author} · {tl2(`report.${r.status}` as never)}
                {r.verdict && ` · ${tf(`verdicts.${r.verdict}` as never)}`}
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
                      {tl2(`media.${m.kind}` as never)}
                    </span>
                  )}
                  <span className="block truncate text-[10px] text-muted">
                    {tl2(`media.${m.kind}` as never)}
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
