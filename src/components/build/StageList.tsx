import { getTranslations } from "next-intl/server";
import { formatCents } from "@/lib/money";
import { STAGE_STEPS, stepIndex } from "@/lib/stages";
import type { BuildView, StageView } from "@/lib/build";
import { CheckIcon, LockIcon } from "@/components/icons";
import { toneFor } from "@/lib/tones";
import { StatusBadge } from "@/components/ui/Portal";
import { DocIcon, LayersIcon, PaperclipIcon } from "@/components/ui/PortalIcons";
import { PayButton, ManualProofForm } from "@/components/portal/RequestActions";
import {
  ApproveQuoteButton,
  ApproveStageButton,
  StagePhotoForm,
  PurchaseForm,
  AdvanceButton,
  InspectionForm,
  AddQuoteForm,
  AttachQuoteFileForm,
  StageEditor,
} from "./StageActions";

type Role = "client" | "admin" | "field";

function fmtDate(iso: string | null) {
  return iso
    ? new Date(iso).toLocaleString("en-GB", { timeZone: "Africa/Harare", dateStyle: "medium", timeStyle: "short" })
    : "";
}

async function Gallery({ stage, role }: { stage: StageView; role: Role }) {
  const t = await getTranslations("build");
  if (stage.media.length === 0) return null;
  const kinds = ["receipt", "delivery", "progress", "inspection"] as const;
  return (
    <div className="space-y-2">
      {kinds.map((kind) => {
        const items = stage.media.filter((m) => m.kind === kind);
        if (items.length === 0) return null;
        return (
          <div key={kind}>
            <p className="mb-1 text-[11px] font-bold tracking-wide text-muted uppercase">{t(`mediaKind.${kind}` as never)}</p>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
              {items.map((m) =>
                m.url ? (
                  <a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg border border-line">
                    {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URLs */}
                    <img src={m.url} alt={m.note || ""} className="aspect-square w-full object-cover" />
                    <span className="block truncate px-1.5 py-1 text-[10px] text-muted">
                      {fmtDate(m.taken_at ?? m.uploaded_at)}
                      {role !== "field" && typeof m.amount_cents === "number" ? ` · ${formatCents(m.amount_cents)}` : ""}
                    </span>
                  </a>
                ) : null
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Supplier quote cards: supplier's quote file, materials, price, Chosen / Not chosen. */
async function QuoteCards({ stage, role }: { stage: StageView; role: Role }) {
  const t = await getTranslations("build");
  const decided = stage.quotes.some((q) => q.status === "approved");
  return (
    <ul className="space-y-2.5">
      {stage.quotes.map((q) => {
        const label =
          q.status === "approved" ? t("quoteChosen") : q.status === "rejected" ? t("quoteNotChosen") : t("quotePending");
        return (
          <li
            key={q.id}
            data-testid="quote-card"
            className={`rounded-2xl border bg-white p-3 shadow-sm ${q.status === "approved" ? "border-ok-line" : "border-[#e6e9e7]"} ${
              q.status === "rejected" ? "opacity-80" : ""
            }`}
          >
            <div className="flex gap-3">
              {q.file_url && !q.file_is_pdf ? (
                <a href={q.file_url} target="_blank" rel="noopener noreferrer" className="shrink-0" aria-label={t("viewQuoteFile")}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
                  <img src={q.file_url} alt={t("quoteFileOf", { supplier: q.supplier_name })} className="h-20 w-20 rounded-xl object-cover sm:h-24 sm:w-24" />
                </a>
              ) : q.file_url ? (
                <a
                  href={q.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-20 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-xl bg-prog-soft text-prog sm:h-24 sm:w-24"
                >
                  <DocIcon size={28} />
                  <span className="text-[11px] font-bold">PDF</span>
                </a>
              ) : (
                <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-offwhite text-muted sm:h-24 sm:w-24">
                  <LayersIcon size={28} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                  <p className="text-[15px] font-extrabold text-ink">{q.supplier_name}</p>
                  <p className="text-base font-extrabold text-ok">{formatCents(q.amount_cents)}</p>
                </div>
                {q.items && (
                  <ul className="mt-1 space-y-0.5 text-[13px] text-ink">
                    {q.items
                      .split("\n")
                      .map((l) => l.trim())
                      .filter(Boolean)
                      .slice(0, 8)
                      .map((line, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted/60" />
                          {line}
                        </li>
                      ))}
                  </ul>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusBadge tone={q.status === "approved" ? "ok" : q.status === "rejected" ? "grey" : "prog"}>
                    {label}
                  </StatusBadge>
                  {q.file_url && (
                    <a href={q.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-forest underline underline-offset-2">
                      <PaperclipIcon size={14} />
                      {t("viewQuoteFile")}
                    </a>
                  )}
                  {role === "client" && q.status === "pending" && !decided && stage.status === "quoting" && (
                    <ApproveQuoteButton quoteId={q.id} supplier={q.supplier_name} />
                  )}
                </div>
                {role === "admin" && <AttachQuoteFileForm kind="stage" quoteId={q.id} hasFile={Boolean(q.file_url)} />}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Numbered tracker of ALL build stages with check marks. */
export async function BuildTracker({ build }: { build: BuildView }) {
  const t = await getTranslations("build");
  const current = build.stages.find((s) => s.status !== "approved" && s.status !== "locked");
  return (
    <nav aria-label={t("buildStages")} className="card px-3 py-4 sm:px-5" data-testid="build-tracker">
      <ol className="flex items-start">
        {build.stages.map((s, i) => {
          const done = s.status === "approved";
          const isCurrent = current?.id === s.id;
          return (
            <li key={s.id} className="relative flex min-w-0 flex-1 flex-col items-center text-center">
              {i > 0 && (
                <span
                  aria-hidden
                  className={`absolute top-[17px] right-1/2 h-[3px] w-full -translate-y-1/2 ${
                    done || isCurrent ? "bg-forest" : "bg-[#dfe3e1]"
                  }`}
                />
              )}
              <a
                href={`#stage-${s.position}`}
                aria-current={isCurrent ? "step" : undefined}
                className={`relative z-10 flex h-[34px] w-[34px] items-center justify-center rounded-full text-sm font-extrabold ${
                  done
                    ? "bg-forest text-white"
                    : isCurrent
                      ? "bg-forest text-white ring-4 ring-ok-soft"
                      : "border-2 border-[#d5dad7] bg-[#eef1ef] text-muted"
                }`}
              >
                {done ? <CheckIcon width={16} height={16} /> : i + 1}
              </a>
              <span className={`mt-1.5 line-clamp-2 px-0.5 text-[10px] leading-tight font-semibold sm:text-xs ${isCurrent ? "text-forest" : "text-muted"}`}>
                {s.name}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function StepDots({ status }: { status: StageView["status"] }) {
  const current = stepIndex(status);
  return (
    <ol className="flex gap-1" aria-hidden>
      {STAGE_STEPS.map((s) => {
        const i = stepIndex(s);
        return (
          <li
            key={s}
            className={`h-1.5 flex-1 rounded-full ${
              status === "approved" || i < current ? "bg-forest" : i === current ? "bg-prog-line" : "bg-line"
            }`}
          />
        );
      })}
    </ol>
  );
}

async function StageBody({
  stage,
  prev,
  role,
  meId,
}: {
  stage: StageView;
  prev: StageView | null;
  role: Role;
  meId: string;
}) {
  const t = await getTranslations("build");
  const staff = role !== "client";
  const iBought = stage.purchases.some((p) => p.purchased_by === meId);
  const approvedQuote = stage.quotes.find((q) => q.status === "approved");

  switch (stage.status) {
    case "locked":
      return (
        <p className="flex items-center gap-2 text-sm text-muted">
          <LockIcon width={16} height={16} />
          {prev ? t("lockedUntil", { stage: prev.name }) : t("lockedStart")}
        </p>
      );

    case "quoting":
      if (role === "field") return <p className="text-sm text-muted">{t("waitQuotes")}</p>;
      return (
        <div className="space-y-3">
          {stage.quotes.length === 0 ? (
            <p className="text-sm text-muted">{role === "client" ? t("collectingQuotes") : t("noQuotesYet")}</p>
          ) : (
            <>
              {role === "client" && <p className="text-sm text-ink">{t("pickSupplier")}</p>}
              <QuoteCards stage={stage} role={role} />
            </>
          )}
          {role === "admin" && <AddQuoteForm stageId={stage.id} />}
        </div>
      );

    case "quote_approved":
      if (role === "field") return <p className="text-sm text-muted">{t("waitPayment")}</p>;
      return (
        <div className="space-y-2">
          {approvedQuote && (
            <p className="text-sm text-ink">
              {t("chosenSupplier", { supplier: approvedQuote.supplier_name })} ·{" "}
              <strong>{formatCents(approvedQuote.amount_cents)}</strong>
            </p>
          )}
          {role === "client" && stage.payment && ["pending", "failed"].includes(stage.payment.status) && (
            <div className="flex flex-wrap items-start gap-2">
              <PayButton paymentId={stage.payment.id} />
              <ManualProofForm paymentId={stage.payment.id} />
            </div>
          )}
          {stage.payment && (
            <p className="text-xs text-muted">
              {t(`paymentStatus.${stage.payment.status}` as never)} · {stage.payment.merchant_reference}
            </p>
          )}
        </div>
      );

    case "paid":
    case "purchased":
      return (
        <div className="space-y-3">
          <p className="text-sm text-ink">{stage.status === "paid" ? t("paidNowBuying") : t("boughtWaitingDelivery")}</p>
          {stage.purchases.length > 0 && (
            <ul className="space-y-1 text-xs text-muted">
              {stage.purchases.map((p) => (
                <li key={p.id}>
                  {p.supplier_name}
                  {role !== "field" ? ` · ${formatCents(p.amount_cents)}` : ""} · {fmtDate(p.created_at)}
                </li>
              ))}
            </ul>
          )}
          {staff && <PurchaseForm stageId={stage.id} stageName={stage.name} />}
          {staff && stage.status === "purchased" && (
            <div className="space-y-2 border-t border-line pt-3">
              <p className="text-xs font-bold text-forest">{t("deliveryStep")}</p>
              <StagePhotoForm stageId={stage.id} stageName={stage.name} kind="delivery" />
              {stage.media.some((m) => m.kind === "delivery") && <AdvanceButton stageId={stage.id} to="delivered" />}
            </div>
          )}
        </div>
      );

    case "delivered":
      return (
        <div className="space-y-2">
          <p className="text-sm text-ink">{t("deliveredWaitingBuilders")}</p>
          {staff && <AdvanceButton stageId={stage.id} to="building" />}
        </div>
      );

    case "building":
      return (
        <div className="space-y-3">
          <p className="text-sm text-ink">{t("buildersWorking")}</p>
          {staff && (
            <>
              <StagePhotoForm stageId={stage.id} stageName={stage.name} kind="progress" />
              <div className="space-y-2 border-t border-line pt-3">
                <p className="text-xs font-bold text-forest">{t("inspectionStep")}</p>
                {iBought ? (
                  <p className="rounded-xl bg-info p-3 text-xs font-semibold text-ink">{t("error.buyerCannotInspect")}</p>
                ) : (
                  <InspectionForm
                    stageId={stage.id}
                    stageName={stage.name}
                    defaultMaterials={(approvedQuote?.items ?? "").trim()}
                  />
                )}
              </div>
            </>
          )}
        </div>
      );

    case "inspected":
      return (
        <div className="space-y-3">
          {stage.inspection && (
            <div className="rounded-xl bg-info p-3 text-sm text-ink">
              <p className="font-bold">{t("inspectionReport")}</p>
              <p className="mt-1 whitespace-pre-line">{stage.inspection.notes}</p>
              <p className="mt-2 text-xs font-bold">{t("materialsUsed")}</p>
              <ul className="mt-1 list-inside list-disc text-xs">
                {stage.inspection.materials_used.map((m, i) => (
                  <li key={i}>
                    {m.item}
                    {m.quantity ? ` — ${m.quantity}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {role === "client" ? (
            <ApproveStageButton stageId={stage.id} stageName={stage.name} />
          ) : (
            <p className="text-sm text-muted">{t("waitClientApproval")}</p>
          )}
        </div>
      );

    case "approved":
      return (
        <p className="flex items-center gap-2 text-sm font-semibold text-forest">
          <CheckIcon width={16} height={16} />
          {t("approvedBy", { name: stage.approved_by_name ?? "", date: fmtDate(stage.approved_at) })}
        </p>
      );
  }
}

export default async function StageList({
  build,
  role,
  meId,
}: {
  build: BuildView;
  role: Role;
  meId: string;
}) {
  const t = await getTranslations("build");
  const current = build.stages.find((s) => s.status !== "approved" && s.status !== "locked");

  return (
    <div className="space-y-3">
    <BuildTracker build={build} />
    <ol className="space-y-3">
      {build.stages.map((stage, i) => {
        const isCurrent = current?.id === stage.id;
        return (
          <li
            key={stage.id}
            id={`stage-${stage.position}`}
            className={`card scroll-mt-28 p-4 sm:p-5 ${isCurrent ? "ring-2 ring-forest" : ""} ${stage.status === "locked" ? "opacity-75" : ""}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span className="inline-flex rounded-full bg-ok-soft px-3 py-1 text-xs font-extrabold text-forest">
                  {t("stageN", { n: i + 1 })}
                </span>
                <h3 className="mt-1.5 text-xl font-extrabold text-ink">{stage.name}</h3>
                {stage.description && <p className="mt-0.5 text-sm text-muted">{stage.description}</p>}
              </div>
              <StatusBadge tone={toneFor(stage.status)} className="shrink-0">
                {t(`status.${stage.status}` as never)}
              </StatusBadge>
            </div>

            {stage.status !== "locked" && (
              <div className="mt-3">
                <StepDots status={stage.status} />
              </div>
            )}

            <div className="mt-3">
              <StageBody stage={stage} prev={i > 0 ? build.stages[i - 1] : null} role={role} meId={meId} />
            </div>

            {role !== "field" && !["locked", "quoting"].includes(stage.status) && stage.quotes.length > 0 && (
              <details className="mt-3" open={stage.status === "quote_approved"}>
                <summary className="cursor-pointer text-xs font-semibold text-forest">
                  {t("supplierQuotesN", { count: stage.quotes.length })}
                </summary>
                <div className="mt-2">
                  <QuoteCards stage={stage} role={role} />
                </div>
              </details>
            )}

            {stage.status !== "locked" && stage.status !== "inspected" && stage.inspection && (
              <details className="mt-3 text-xs text-muted">
                <summary className="cursor-pointer font-semibold text-forest">{t("inspectionReport")}</summary>
                <p className="mt-1 whitespace-pre-line text-ink">{stage.inspection.notes}</p>
                <ul className="mt-1 list-inside list-disc">
                  {stage.inspection.materials_used.map((m, j) => (
                    <li key={j}>{m.item}{m.quantity ? ` — ${m.quantity}` : ""}</li>
                  ))}
                </ul>
              </details>
            )}

            {stage.media.length > 0 && (
              <details className="mt-3" open={isCurrent || stage.status === "inspected"}>
                <summary className="cursor-pointer text-xs font-semibold text-forest">
                  {t("photos", { count: stage.media.length })}
                </summary>
                <div className="mt-2">
                  <Gallery stage={stage} role={role} />
                </div>
              </details>
            )}

            {role === "admin" && stage.status !== "approved" && (
              <div className="mt-3 border-t border-line pt-2">
                <StageEditor
                  stageId={stage.id}
                  name={stage.name}
                  description={stage.description}
                  canMove={stage.status === "locked"}
                  canDelete={stage.status === "locked"}
                />
              </div>
            )}
          </li>
        );
      })}
    </ol>
    </div>
  );
}
