import { getTranslations } from "next-intl/server";
import { formatCents } from "@/lib/money";
import { STAGE_STEPS, stepIndex } from "@/lib/stages";
import type { BuildView, StageView } from "@/lib/build";
import { CheckIcon, LockIcon } from "@/components/icons";
import { PayButton, ManualProofForm } from "@/components/portal/RequestActions";
import {
  ApproveQuoteButton,
  ApproveStageButton,
  StagePhotoForm,
  PurchaseForm,
  AdvanceButton,
  InspectionForm,
  AddQuoteForm,
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
              status === "approved" || i < current ? "bg-forest" : i === current ? "bg-accent" : "bg-line"
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
        <div className="space-y-2">
          {stage.quotes.length === 0 ? (
            <p className="text-sm text-muted">{role === "client" ? t("collectingQuotes") : t("noQuotesYet")}</p>
          ) : (
            <>
              {role === "client" && <p className="text-sm text-ink">{t("pickSupplier")}</p>}
              <ul className="space-y-2">
                {stage.quotes.map((q) => (
                  <li key={q.id} className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-line p-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-ink">{q.supplier_name}</p>
                      {q.items && <p className="mt-0.5 text-xs whitespace-pre-line text-muted">{q.items}</p>}
                    </div>
                    <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:flex-col sm:items-end">
                      <span className="text-sm font-extrabold text-forest">{formatCents(q.amount_cents)}</span>
                      {role === "client" && q.status === "pending" && (
                        <ApproveQuoteButton quoteId={q.id} supplier={q.supplier_name} />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
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
          {staff && <PurchaseForm stageId={stage.id} />}
          {staff && stage.status === "purchased" && (
            <div className="space-y-2 border-t border-line pt-3">
              <p className="text-xs font-bold text-forest">{t("deliveryStep")}</p>
              <StagePhotoForm stageId={stage.id} kind="delivery" />
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
              <StagePhotoForm stageId={stage.id} kind="progress" />
              <div className="space-y-2 border-t border-line pt-3">
                <p className="text-xs font-bold text-forest">{t("inspectionStep")}</p>
                {iBought ? (
                  <p className="rounded-xl bg-info p-3 text-xs font-semibold text-ink">{t("error.buyerCannotInspect")}</p>
                ) : (
                  <InspectionForm
                    stageId={stage.id}
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
    <ol className="space-y-3">
      {build.stages.map((stage, i) => {
        const isCurrent = current?.id === stage.id;
        return (
          <li
            key={stage.id}
            id={`stage-${stage.position}`}
            className={`card p-4 ${isCurrent ? "ring-2 ring-forest" : ""} ${stage.status === "locked" ? "opacity-75" : ""}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-bold tracking-wide text-muted uppercase">
                  {t("stageN", { n: i + 1 })}
                </p>
                <h3 className="text-base font-bold text-forest">{stage.name}</h3>
                {stage.description && <p className="mt-0.5 text-xs text-muted">{stage.description}</p>}
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  stage.status === "approved"
                    ? "bg-forest text-white"
                    : stage.status === "locked"
                      ? "bg-line text-muted"
                      : "bg-accent text-white"
                }`}
              >
                {t(`status.${stage.status}` as never)}
              </span>
            </div>

            {stage.status !== "locked" && (
              <div className="mt-3">
                <StepDots status={stage.status} />
              </div>
            )}

            <div className="mt-3">
              <StageBody stage={stage} prev={i > 0 ? build.stages[i - 1] : null} role={role} meId={meId} />
            </div>

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
  );
}
