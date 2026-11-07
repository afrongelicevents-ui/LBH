"use client";

import { useDirectUpload } from "@/lib/useDirectUpload";

import { useState, useTransition, useActionState } from "react";
import { useTranslations } from "next-intl";
import {
  setBookingStatus,
  saveQuote,
  sendDraftQuote,
  assignStaff,
  forwardExtraCost,
  rejectExtraCost,
  addSupplierQuote,
  requestReportChanges,
  publishReport,
  confirmManualPayment,
  setRequestStatus,
  saveSettings,
  inviteStaff,
  markTranslationReviewed,
  type ActionResult,
} from "@/app/[locale]/admin/actions";
import { formatCents } from "@/lib/money";

const inputCls =
  "w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink focus:border-forest focus:outline-none";
const labelCls = "mb-1 block text-xs font-semibold text-ink";

function useAct() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      try {
        setResult(await fn());
      } catch {
        setResult({ ok: false, error: "error" }); // no connection
      }
    });
  return { pending, result, run };
}

function Err({ result }: { result: ActionResult | null }) {
  const t = useTranslations("admin.common");
  if (!result || result.ok) return null;
  return (
    <span role="alert" className="text-xs font-bold text-red-700">
      {t(`error.${result.error}` as never)}
    </span>
  );
}

// ---------- generic small action button ----------
export function ActButton({
  label,
  primary = false,
  action,
}: {
  label: string;
  primary?: boolean;
  action: () => Promise<ActionResult>;
}) {
  const { pending, result, run } = useAct();
  if (result?.ok) return null;
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => run(action)}
        className={`btn min-h-10 px-4 text-xs disabled:opacity-60 ${primary ? "btn-primary" : "btn-outline-green"}`}
      >
        {label}
      </button>
      <Err result={result} />
    </span>
  );
}

export function BookingStatusButtons({ bookingId }: { bookingId: string }) {
  const t = useTranslations("admin.bookings");
  return (
    <div className="flex flex-wrap gap-2">
      <ActButton primary label={t("confirm")} action={() => setBookingStatus(bookingId, "confirmed")} />
      <ActButton label={t("complete")} action={() => setBookingStatus(bookingId, "completed")} />
      <ActButton label={t("cancel")} action={() => setBookingStatus(bookingId, "cancelled")} />
    </div>
  );
}

// ---------- quote builder (brief §8: travel = km × rate) ----------
interface LineDraft {
  kind: "service_fee" | "travel" | "other";
  description: string;
  qty: string;
  unit: string;
}

export function QuoteBuilder({
  requestId,
  perKmRateCents,
  defaultDepositPct,
}: {
  requestId: string;
  perKmRateCents: number;
  defaultDepositPct: number;
}) {
  const t = useTranslations("admin.quote");
  const [lines, setLines] = useState<LineDraft[]>([
    { kind: "service_fee", description: t("defaultServiceFee"), qty: "1", unit: "" },
    {
      kind: "travel",
      description: t("defaultTravel", { rate: (perKmRateCents / 100).toFixed(2) }),
      qty: "",
      unit: (perKmRateCents / 100).toFixed(2),
    },
  ]);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    async (prev, fd) => {
      fd.set(
        "lines_json",
        JSON.stringify(
          lines
            .filter((l) => l.description.trim() && l.qty && l.unit)
            .map((l) => ({
              kind: l.kind,
              description: l.description,
              qty: Number(l.qty),
              unit_cents: Math.round(Number(l.unit) * 100),
            }))
        )
      );
      return saveQuote(prev, fd);
    },
    null
  );

  const total = lines.reduce((s, l) => {
    const v = Number(l.qty) * Number(l.unit) * 100;
    return s + (Number.isFinite(v) ? Math.round(v) : 0);
  }, 0);

  function patch(i: number, p: Partial<LineDraft>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...p } : l)));
  }

  if (state?.ok) {
    return <p className="text-sm font-bold text-forest">{t("saved")}</p>;
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="request_id" value={requestId} />
      {lines.map((l, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2 border-b border-line pb-2 sm:grid-cols-[110px_1fr_70px_80px_auto] sm:border-0 sm:pb-0">
          <label>
            <span className={labelCls}>{t("kind")}</span>
            <select
              value={l.kind}
              onChange={(e) => patch(i, { kind: e.target.value as LineDraft["kind"] })}
              className={inputCls}
            >
              <option value="service_fee">{t("kinds.service_fee")}</option>
              <option value="travel">{t("kinds.travel")}</option>
              <option value="other">{t("kinds.other")}</option>
            </select>
          </label>
          <label className="col-span-3 sm:col-span-1">
            <span className={labelCls}>{t("description")}</span>
            <input
              value={l.description}
              onChange={(e) => patch(i, { description: e.target.value })}
              className={inputCls}
              maxLength={300}
            />
          </label>
          <label>
            <span className={labelCls}>{l.kind === "travel" ? t("km") : t("qty")}</span>
            <input
              value={l.qty}
              onChange={(e) => patch(i, { qty: e.target.value })}
              className={inputCls}
              inputMode="decimal"
            />
          </label>
          <label>
            <span className={labelCls}>{t("unitUsd")}</span>
            <input
              value={l.unit}
              onChange={(e) => patch(i, { unit: e.target.value })}
              className={inputCls}
              inputMode="decimal"
            />
          </label>
          <button
            type="button"
            onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
            className="pb-2 text-xs font-bold text-muted hover:text-red-700"
            aria-label={t("removeLine")}
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          setLines((prev) => [...prev, { kind: "other", description: "", qty: "1", unit: "" }])
        }
        className="text-xs font-semibold text-forest underline underline-offset-2"
      >
        + {t("addLine")}
      </button>

      <div className="flex flex-wrap items-end gap-4 border-t border-line pt-3">
        <label>
          <span className={labelCls}>{t("depositPct")}</span>
          <input
            name="deposit_pct"
            type="number"
            min={1}
            max={100}
            defaultValue={defaultDepositPct}
            className={`${inputCls} w-24`}
          />
        </label>
        <label className="flex-1">
          <span className={labelCls}>{t("notes")}</span>
          <input name="notes" maxLength={2000} className={inputCls} />
        </label>
        <p className="pb-2 text-sm font-extrabold text-forest">
          {t("total")}: {formatCents(total)}
        </p>
      </div>

      {state && !state.ok && <Err result={state} />}
      <div className="flex gap-3">
        <button type="submit" disabled={pending} className="btn btn-outline-green min-h-10 text-sm disabled:opacity-60">
          {t("saveDraft")}
        </button>
        <button
          type="submit"
          name="send"
          value="1"
          disabled={pending}
          className="btn btn-primary min-h-10 text-sm disabled:opacity-60"
        >
          {t("sendToClient")}
        </button>
      </div>
    </form>
  );
}

export function SendDraftQuoteButton({ quoteId }: { quoteId: string }) {
  const t = useTranslations("admin.quote");
  return <ActButton primary label={t("sendToClient")} action={() => sendDraftQuote(quoteId)} />;
}

// ---------- assign staff ----------
export function AssignStaffForm({
  requestId,
  staff,
}: {
  requestId: string;
  staff: { id: string; full_name: string; staff_kind?: string | null }[];
}) {
  const t = useTranslations("admin.request");
  const [staffId, setStaffId] = useState("");
  const [jobType, setJobType] = useState<"site_visit" | "title_check">("site_visit");
  const [dueDate, setDueDate] = useState("");
  const { pending, result, run } = useAct();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select value={staffId} onChange={(e) => setStaffId(e.target.value)} className={`${inputCls} w-56`}>
        <option value="">{t("chooseStaff")}</option>
        {staff.map((s) => (
          <option key={s.id} value={s.id}>
            {s.full_name} · {s.staff_kind === "lawyer" ? t("jobTypes.title_check") : t("jobTypes.site_visit")}
          </option>
        ))}
      </select>
      <select
        value={jobType}
        onChange={(e) => setJobType(e.target.value as "site_visit" | "title_check")}
        aria-label={t("jobType")}
        className={`${inputCls} w-48`}
      >
        <option value="site_visit">{t("jobTypes.site_visit")}</option>
        <option value="title_check">{t("jobTypes.title_check")}</option>
      </select>
      <label className="flex items-center gap-2 text-xs font-semibold text-ink">
        {t("dueDate")}
        <input
          type="date"
          name="due_date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className={`${inputCls} w-40`}
        />
      </label>
      <button
        type="button"
        disabled={!staffId || pending}
        onClick={() => run(() => assignStaff(requestId, staffId, jobType, dueDate))}
        className="btn btn-primary min-h-10 px-4 text-xs disabled:opacity-60"
      >
        {t("assign")}
      </button>
      {result?.ok && <span className="text-xs font-bold text-forest">{t("assigned")}</span>}
      <Err result={result} />
    </div>
  );
}

// ---------- extra costs ----------
export function ExtraCostControls({ ecrId }: { ecrId: string }) {
  const t = useTranslations("admin.request");
  return (
    <div className="flex flex-wrap gap-2">
      <ActButton primary label={t("forwardToClient")} action={() => forwardExtraCost(ecrId)} />
      <ActButton label={t("reject")} action={() => rejectExtraCost(ecrId, "")} />
    </div>
  );
}

// ---------- supplier quote ----------
export function SupplierQuoteForm({ requestId }: { requestId: string }) {
  const t = useTranslations("admin.request");
  const { upload } = useDirectUpload();
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    async (prev, fd) => {
      const file = fd.get("quote_file");
      fd.delete("quote_file");
      if (file instanceof File && file.size > 0) {
        const up = await upload("quote-file", [file]);
        if (!up.ok) return { ok: false, error: up.error === "size" ? "toobig" : up.error === "type" ? "filetype" : "error" };
        fd.set("uploads_json", JSON.stringify(up.refs));
      }
      return addSupplierQuote(prev, fd);
    },
    null
  );
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      {state?.ok && <p className="w-full text-xs font-bold text-forest">{t("supplierAdded")}</p>}
      <input type="hidden" name="request_id" value={requestId} />
      <label className="flex-1">
        <span className={labelCls}>{t("supplierName")}</span>
        <input name="supplier_name" required className={inputCls} maxLength={200} />
      </label>
      <label>
        <span className={labelCls}>{t("amountUsd")}</span>
        <input name="amount" required className={`${inputCls} w-28`} inputMode="decimal" />
      </label>
      <label className="flex-1">
        <span className={labelCls}>{t("supplierDetails")}</span>
        <input name="details" className={inputCls} maxLength={2000} />
      </label>
      <label className="w-full">
        <span className={labelCls}>{t("supplierQuoteFile")}</span>
        <input
          type="file"
          name="quote_file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="block w-full text-xs text-muted file:mr-3 file:rounded-full file:border-0 file:bg-forest file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
        />
      </label>
      <button type="submit" disabled={pending} className="btn btn-outline-green min-h-10 px-4 text-xs disabled:opacity-60">
        {t("addSupplier")}
      </button>
      {state && !state.ok && <Err result={state} />}
    </form>
  );
}

// ---------- report review ----------
export function ReportReviewControls({
  reportId,
  canPublish,
}: {
  reportId: string;
  canPublish: boolean;
}) {
  const t = useTranslations("admin.request");
  const [note, setNote] = useState("");
  const { pending, result, run } = useAct();
  if (result?.ok) return <p className="text-xs font-bold text-forest">{t("done")}</p>;
  return (
    <div className="space-y-2">
      {!canPublish && (
        <p className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs font-bold text-red-800">
          {t("selfPublishBlocked")}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {canPublish && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => publishReport(reportId))}
            className="btn btn-primary min-h-10 px-4 text-xs disabled:opacity-60"
          >
            {t("publish")}
          </button>
        )}
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t("changesNote")}
          className={`${inputCls} w-64`}
          maxLength={2000}
        />
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => requestReportChanges(reportId, note))}
          className="btn btn-outline-green min-h-10 px-4 text-xs disabled:opacity-60"
        >
          {t("requestChanges")}
        </button>
        <Err result={result} />
      </div>
    </div>
  );
}

export function ConfirmPaymentButton({ paymentId }: { paymentId: string }) {
  const t = useTranslations("admin.payments");
  return (
    <ActButton primary label={t("confirmPayment")} action={() => confirmManualPayment(paymentId)} />
  );
}

export function RequestStatusButtons({ requestId }: { requestId: string }) {
  const t = useTranslations("admin.request");
  return (
    <div className="flex flex-wrap gap-2">
      <ActButton label={t("markCallBooked")} action={() => setRequestStatus(requestId, "call_booked")} />
      <ActButton label={t("markDone")} action={() => setRequestStatus(requestId, "done")} />
      <ActButton label={t("markCancelled")} action={() => setRequestStatus(requestId, "cancelled")} />
    </div>
  );
}

// ---------- settings ----------
export function SettingsForm({
  settings,
}: {
  settings: {
    per_km_rate_cents: number;
    deposit_pct: number;
    whatsapp_number: string;
    contact_email: string;
    call_slots: { id: string; label: string }[];
    banned_words: string[];
  };
}) {
  const t = useTranslations("admin.settings");
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    saveSettings,
    null
  );
  return (
    <form action={formAction} className="card max-w-2xl space-y-4 p-6">
      {state?.ok && <p className="text-sm font-bold text-forest">{t("saved")}</p>}
      {state && !state.ok && <Err result={state} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className={labelCls}>{t("perKmRate")}</span>
          <input
            name="per_km_rate"
            defaultValue={(settings.per_km_rate_cents / 100).toFixed(2)}
            className={inputCls}
            inputMode="decimal"
          />
        </label>
        <label>
          <span className={labelCls}>{t("depositPct")}</span>
          <input
            name="deposit_pct"
            type="number"
            min={1}
            max={100}
            defaultValue={settings.deposit_pct}
            className={inputCls}
          />
        </label>
        <label>
          <span className={labelCls}>{t("whatsapp")}</span>
          <input
            name="whatsapp_number"
            defaultValue={settings.whatsapp_number}
            className={inputCls}
            pattern="[0-9]{6,15}"
          />
        </label>
        <label>
          <span className={labelCls}>{t("email")}</span>
          <input
            name="contact_email"
            type="email"
            defaultValue={settings.contact_email}
            className={inputCls}
          />
        </label>
      </div>
      <label className="block">
        <span className={labelCls}>{t("callSlots")}</span>
        <textarea
          name="call_slots"
          rows={4}
          defaultValue={settings.call_slots.map((s) => s.label).join("\n")}
          className={inputCls}
        />
        <span className="mt-1 block text-[11px] text-muted">{t("callSlotsHint")}</span>
      </label>
      <label className="block">
        <span className={labelCls}>{t("bannedWords")}</span>
        <input
          name="banned_words"
          defaultValue={settings.banned_words.join(", ")}
          className={inputCls}
        />
      </label>
      <button type="submit" disabled={pending} className="btn btn-primary min-h-10 text-sm disabled:opacity-60">
        {t("save")}
      </button>
    </form>
  );
}

// ---------- staff invite ----------
export function InviteStaffForm() {
  const t = useTranslations("admin.settings");
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    inviteStaff,
    null
  );
  if (state?.ok) return <p className="text-sm font-bold text-forest">{t("staffInvited")}</p>;
  return (
    <form action={formAction} className="card max-w-2xl space-y-3 p-6">
      <h2 className="text-sm font-bold text-forest">{t("inviteStaffTitle")}</h2>
      {state && !state.ok && <Err result={state} />}
      <div className="grid gap-3 sm:grid-cols-3">
        <label>
          <span className={labelCls}>{t("staffName")}</span>
          <input name="full_name" required className={inputCls} maxLength={120} />
        </label>
        <label>
          <span className={labelCls}>{t("staffEmail")}</span>
          <input name="email" type="email" required className={inputCls} />
        </label>
        <label>
          <span className={labelCls}>{t("staffRole")}</span>
          <select name="role" className={inputCls}>
            <option value="field">{t("roleField")}</option>
            <option value="lawyer">{t("roleLawyer")}</option>
            <option value="admin">{t("roleAdmin")}</option>
          </select>
        </label>
      </div>
      <button type="submit" disabled={pending} className="btn btn-outline-green min-h-10 text-sm disabled:opacity-60">
        {t("invite")}
      </button>
      <p className="text-[11px] text-muted">{t("mfaNote")}</p>
    </form>
  );
}

// ---------- translation review toggle ----------
export function TranslationReviewToggle({
  locale,
  messageKey,
  reviewed,
}: {
  locale: string;
  messageKey: string;
  reviewed: boolean;
}) {
  const t = useTranslations("admin.translations");
  const { pending, result, run } = useAct();
  // Optimistic value from the last click; the refreshed prop wins once it matches
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const isReviewed = optimistic !== null && result?.ok !== false ? optimistic : reviewed;
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        const next = !isReviewed;
        setOptimistic(next);
        run(() => markTranslationReviewed(locale, messageKey, next));
      }}
      className={`rounded-full px-3 py-1 text-[11px] font-bold ${
        isReviewed ? "bg-forest text-white" : "bg-info text-ink"
      } disabled:opacity-60`}
    >
      {isReviewed ? t("reviewed") : t("markReviewed")}
    </button>
  );
}
