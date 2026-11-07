"use client";

import { useState, useActionState } from "react";
import { useTranslations } from "next-intl";
import { requestExtraCost, type ActionResult } from "@/app/[locale]/field/actions";
import { LEGAL_ITEMS, LEGAL_STATUSES, type LegalChecklist } from "@/lib/legal";
import CameraCapture, { type Captured } from "./CameraCapture";
import { useOutbox } from "./OutboxProvider";
import { useOfflineForm } from "./useOfflineForm";

const inputCls =
  "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink focus:border-forest focus:outline-none";
const labelCls = "mb-1 block text-xs font-semibold text-ink";

function Feedback({ state }: { state: ActionResult | null }) {
  const t = useTranslations("field");
  if (!state) return null;
  return state.ok ? (
    <p className="mt-2 text-xs font-bold text-forest">{t("saved")}</p>
  ) : (
    <p role="alert" className="mt-2 text-xs font-bold text-red-700">
      {t(`error.${state.error}` as never)}
    </p>
  );
}

/** "Saved on this phone" — the outbox bar shows when it has uploaded. */
export function QueuedNote({ show, failed = false }: { show: boolean; failed?: boolean }) {
  const t = useTranslations("field.outbox");
  const te = useTranslations("field.error");
  if (failed) {
    return (
      <p role="alert" className="mt-2 text-xs font-bold text-red-700">
        {te("storage")}
      </p>
    );
  }
  if (!show) return null;
  return (
    <p role="status" className="mt-2 text-xs font-bold text-forest">
      {t("savedOnPhone")}
    </p>
  );
}

// ---------- visit checklist ----------
export function VisitForm({
  jobId,
  jobLabel,
  visit,
}: {
  jobId: string;
  jobLabel: string;
  visit: Record<string, unknown>;
}) {
  const t = useTranslations("field");
  const { formRef, onSubmit, saved, busy } = useOfflineForm(
    "job-visit",
    jobId,
    `${t("visitTitle")} — ${jobLabel}`
  );
  const m = (visit.measurements ?? {}) as Record<string, number | null>;

  const checks = [
    ["arrived", Boolean(visit.arrived)],
    ["council_officer_present", Boolean(visit.council_officer_present)],
    ["pegs_shown", Boolean(visit.pegs_shown)],
  ] as const;

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        {checks.map(([name, checked]) => (
          <label key={name} className="flex min-h-10 items-center gap-2.5 text-sm text-ink">
            <input
              type="checkbox"
              name={name}
              defaultChecked={checked}
              className="h-5 w-5 rounded accent-[#163a2b]"
            />
            {t(`visit.${name}` as never)}
          </label>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {(["length_m", "width_m", "area_sqm"] as const).map((f) => (
          <label key={f} className="block">
            <span className={labelCls}>{t(`visit.${f}`)}</span>
            <input
              name={f}
              type="number"
              step="0.01"
              min="0"
              defaultValue={m[f] ?? ""}
              className={inputCls}
            />
          </label>
        ))}
      </div>
      <label className="block">
        <span className={labelCls}>{t("visit.title_notes")}</span>
        <textarea
          name="title_notes"
          rows={2}
          defaultValue={String(visit.title_notes ?? "")}
          className={inputCls}
        />
      </label>
      <label className="block">
        <span className={labelCls}>{t("visit.findings")}</span>
        <textarea
          name="findings"
          rows={3}
          defaultValue={String(visit.findings ?? "")}
          className={inputCls}
        />
      </label>
      <button type="submit" disabled={busy} className="btn btn-green min-h-10 text-sm disabled:opacity-60">
        {t("saveVisit")}
      </button>
      <QueuedNote show={saved === "queued"} failed={saved === "failed"} />
    </form>
  );
}

// ---------- lawyer: legal checklist (title check) ----------
export function LegalChecklistForm({
  jobId,
  jobLabel,
  legal,
}: {
  jobId: string;
  jobLabel: string;
  legal: LegalChecklist;
}) {
  const t = useTranslations("field.legal");
  const tf = useTranslations("field");
  const { formRef, onSubmit, saved, busy } = useOfflineForm(
    "job-legal",
    jobId,
    `${t("title")} — ${jobLabel}`
  );

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4" data-testid="legal-form">
      {LEGAL_ITEMS.map((item) => {
        const current = legal.items[item];
        return (
          <fieldset key={item} className="rounded-xl border border-line p-3">
            <legend className="px-1 text-sm font-bold text-forest">{t(`items.${item}`)}</legend>
            <p className="text-[11px] text-muted">{t(`hints.${item}`)}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {LEGAL_STATUSES.map((st) => (
                <label
                  key={st}
                  className="flex min-h-10 cursor-pointer items-center gap-2 rounded-full border border-line px-3 text-xs font-semibold text-ink has-checked:border-forest has-checked:bg-offwhite"
                >
                  <input
                    type="radio"
                    name={`${item}_status`}
                    value={st}
                    defaultChecked={(current?.status ?? "pending") === st}
                    className="h-4 w-4 accent-[#163a2b]"
                  />
                  {t(`status.${st}`)}
                </label>
              ))}
            </div>
            <textarea
              name={`${item}_note`}
              rows={2}
              maxLength={4000}
              placeholder={t("notePlaceholder")}
              defaultValue={current?.note ?? ""}
              className={`${inputCls} mt-2`}
            />
          </fieldset>
        );
      })}
      <label className="block">
        <span className={labelCls}>{t("findings")}</span>
        <textarea name="findings" rows={4} maxLength={8000} defaultValue={legal.findings} className={inputCls} />
      </label>
      <label className="block">
        <span className={labelCls}>{t("verdict")}</span>
        <select name="verdict" defaultValue={legal.verdict ?? ""} className={inputCls}>
          <option value="">—</option>
          <option value="clear">{tf("verdicts.clear")}</option>
          <option value="concerns">{tf("verdicts.concerns")}</option>
          <option value="red_flags">{tf("verdicts.red_flags")}</option>
        </select>
      </label>
      <button type="submit" disabled={busy} className="btn btn-green min-h-10 text-sm disabled:opacity-60">
        {t("save")}
      </button>
      <QueuedNote show={saved === "queued"} failed={saved === "failed"} />
    </form>
  );
}

// ---------- media: in-app camera only, saved on the phone first ----------
export function MediaUploadForm({
  jobId,
  jobLabel,
  kind,
}: {
  jobId: string;
  jobLabel: string;
  kind: "photo" | "video" | "receipt";
}) {
  const t = useTranslations("field");
  const outbox = useOutbox();
  const [files, setFiles] = useState<Captured[]>([]);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!outbox) return;
    setError(null);
    if (files.length === 0) {
      setError(t("camera.needCapture"));
      return;
    }
    const form = e.currentTarget;
    const fd = new FormData(form);
    const note = String(fd.get("note") ?? "");
    const amount = String(fd.get("amount") ?? "");
    if (kind === "receipt" && !amount.trim()) {
      setError(t("error.invalid"));
      return;
    }
    setBusy(true);
    try {
      for (const f of files) {
        await outbox.enqueue({
          action: "job-media",
          target: jobId,
          label: `${t(`kindLabel.${kind}`)} — ${jobLabel}`,
          fields: { kind, note, amount },
          files: [
            {
              blob: f.blob,
              name: f.name,
              type: f.type,
              capturedAt: f.capturedAt,
              lat: f.lat,
              lng: f.lng,
              accuracy: f.accuracy,
              clientRef: f.clientRef,
            },
          ],
        });
      }
      files.forEach((f) => URL.revokeObjectURL(f.previewUrl));
      setFiles([]);
      form.reset();
      setSaved(true);
    } catch {
      setError(t("error.storage"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3" data-testid={`media-form-${kind}`}>
      <CameraCapture
        mode={kind === "video" ? "video" : "photo"}
        multiple={kind === "photo"}
        value={files}
        onChange={(v) => {
          setFiles(v);
          setSaved(false);
        }}
        label={kind === "receipt" ? t("camera.photoReceipt") : undefined}
      />
      {kind === "receipt" && (
        <label className="block">
          <span className={labelCls}>{t("receiptAmount")} *</span>
          <input name="amount" required inputMode="decimal" placeholder="12.50" className={inputCls} />
        </label>
      )}
      <input name="note" placeholder={t("mediaNote")} maxLength={500} className={inputCls} />
      <button
        type="submit"
        disabled={busy || files.length === 0}
        className="btn btn-primary min-h-10 text-sm disabled:opacity-60"
      >
        {t(`upload.${kind}` as never)}
        {files.length > 1 ? ` (${files.length})` : ""}
      </button>
      {error && (
        <p role="alert" className="text-xs font-bold text-red-700">
          {error}
        </p>
      )}
      <QueuedNote show={saved} />
    </form>
  );
}

// ---------- extra cost ----------
export function ExtraCostForm({ jobId }: { jobId: string }) {
  const t = useTranslations("field");
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    async (prev, fd) => {
      try {
        return await requestExtraCost(jobId, prev, fd);
      } catch {
        return { ok: false, error: "upload" }; // no connection: try again with signal
      }
    },
    null
  );
  if (state?.ok) {
    return <p className="text-sm font-bold text-forest">{t("extraCostSent")}</p>;
  }
  return (
    <form action={formAction} className="space-y-3">
      <label className="block">
        <span className={labelCls}>{t("extraTitle")} *</span>
        <input name="title" required maxLength={200} className={inputCls} />
      </label>
      <label className="block">
        <span className={labelCls}>{t("extraReason")} *</span>
        <textarea name="reason" required rows={2} maxLength={2000} className={inputCls} />
      </label>
      <label className="block">
        <span className={labelCls}>{t("extraAmount")} *</span>
        <input name="amount" required placeholder="25.00" className={inputCls} />
      </label>
      <button type="submit" disabled={pending} className="btn btn-outline-green min-h-10 text-sm disabled:opacity-60">
        {t("sendExtraCost")}
      </button>
      <Feedback state={state} />
    </form>
  );
}

// ---------- report draft ----------
const SECTION_FIELDS = [
  "stand_details",
  "legal_findings",
  "council_confirmation",
  "measurements",
  "red_flags",
  "next_steps",
  "costs_summary",
] as const;

export function ReportDraftForm({
  jobId,
  jobLabel,
  report,
}: {
  jobId: string;
  jobLabel: string;
  report: { verdict: string | null; sections: Record<string, string>; status: string } | null;
}) {
  const t = useTranslations("field");
  const tr = useTranslations("portal.report.section");
  const { formRef, onSubmit, saved, busy: pending } = useOfflineForm(
    "job-report",
    jobId,
    `${t("reportTitle")} — ${jobLabel}`
  );
  const locked = report ? !["draft", "changes_requested"].includes(report.status) : false;

  if (locked) {
    return (
      <p className="text-sm font-bold text-forest">
        {t(`reportStatus.${report!.status}` as never)}
      </p>
    );
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-3">
      {report?.status === "changes_requested" && (
        <p className="rounded-xl bg-info px-3 py-2 text-xs font-bold text-ink">
          {t("changesRequested")}
        </p>
      )}
      <label className="block">
        <span className={labelCls}>{t("verdict")} *</span>
        <select name="verdict" defaultValue={report?.verdict ?? ""} className={inputCls}>
          <option value="">—</option>
          <option value="clear">{t("verdicts.clear")}</option>
          <option value="concerns">{t("verdicts.concerns")}</option>
          <option value="red_flags">{t("verdicts.red_flags")}</option>
        </select>
      </label>
      {SECTION_FIELDS.map((f) => (
        <label key={f} className="block">
          <span className={labelCls}>{tr(f)}</span>
          <textarea
            name={f}
            rows={2}
            maxLength={8000}
            defaultValue={report?.sections?.[f] ?? ""}
            className={inputCls}
          />
        </label>
      ))}
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={pending}
          className="btn btn-outline-green min-h-10 text-sm disabled:opacity-60"
        >
          {t("saveDraft")}
        </button>
        <button
          type="submit"
          name="submit"
          value="1"
          disabled={pending}
          className="btn btn-primary min-h-10 text-sm disabled:opacity-60"
        >
          {t("submitToAdmin")}
        </button>
      </div>
      <p className="text-[11px] text-muted">{t("submitNote")}</p>
      <QueuedNote show={saved === "queued"} failed={saved === "failed"} />
    </form>
  );
}
