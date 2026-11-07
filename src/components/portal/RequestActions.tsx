"use client";

import { useState, useTransition, useActionState } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  acceptQuoteAction,
  decideApprovalAction,
  approveSupplierQuoteAction,
  startPayment,
  submitManualProof,
  type ActionResult,
} from "@/app/[locale]/portal/actions";
import { useDirectUpload } from "@/lib/useDirectUpload";
import { ArrowRightIcon } from "@/components/icons";

export function AcceptQuoteButton({ quoteId }: { quoteId: string }) {
  const t = useTranslations("portal.request");
  const locale = useLocale();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="btn btn-primary">
        {t("acceptQuote")}
        <ArrowRightIcon width={18} height={18} />
      </button>
    );
  }
  return (
    <div className="rounded-xl bg-info p-4 text-ink">
      <p className="text-sm font-semibold text-forest">{t("acceptConfirmText")}</p>
      <div className="mt-3 flex gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => start(() => acceptQuoteAction(quoteId, locale))}
          className="btn btn-primary min-h-10 text-sm disabled:opacity-60"
        >
          {t("acceptConfirmYes")}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirming(false)}
          className="btn btn-outline-green min-h-10 text-sm"
        >
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}

export function ApprovalButtons({ approvalId }: { approvalId: string }) {
  const t = useTranslations("portal.request");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  if (result?.ok) return null; // page revalidates

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setResult(await decideApprovalAction(approvalId, true)))}
        className="btn btn-primary min-h-10 text-sm disabled:opacity-60"
      >
        {t("approve")}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setResult(await decideApprovalAction(approvalId, false)))}
        className="btn btn-outline-green min-h-10 text-sm disabled:opacity-60"
      >
        {t("decline")}
      </button>
      {result && !result.ok && (
        <span className="text-xs font-semibold text-red-700">{t("actionFailed")}</span>
      )}
    </div>
  );
}

export function SupplierQuoteApprove({ id }: { id: string }) {
  const t = useTranslations("portal.request");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  if (result?.ok) return null;
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => setResult(await approveSupplierQuoteAction(id)))}
      className="btn btn-primary min-h-10 px-4 text-xs disabled:opacity-60"
    >
      {t("approveSupplier")}
    </button>
  );
}

export function PayButton({ paymentId }: { paymentId: string }) {
  const t = useTranslations("portal.request");
  const locale = useLocale();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => startPayment(paymentId, locale))}
      className="btn btn-primary min-h-10 text-sm disabled:opacity-60"
    >
      {t("payNow")}
      <ArrowRightIcon width={16} height={16} />
    </button>
  );
}

export function ManualProofForm({ paymentId }: { paymentId: string }) {
  const t = useTranslations("portal.request");
  const [open, setOpen] = useState(false);
  const { upload } = useDirectUpload();
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    async (prev, fd) => {
      const file = fd.get("proof");
      fd.delete("proof");
      const up = await upload("client-document", file instanceof File ? [file] : []);
      if (!up.ok || up.refs.length === 0) return { ok: false as const, error: "upload" };
      fd.set("uploads_json", JSON.stringify(up.refs));
      return submitManualProof(paymentId, prev, fd);
    },
    null
  );

  if (state?.ok) {
    return (
      <p className="text-sm font-semibold text-forest">{t("proofSubmitted")}</p>
    );
  }
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-outline-green min-h-10 text-sm"
      >
        {t("paidManually")}
      </button>
    );
  }
  return (
    <form action={formAction} className="mt-2 w-full rounded-xl border border-line bg-offwhite p-4">
      <p className="text-xs text-muted">{t("proofHint")}</p>
      {state && !state.ok && (
        <p role="alert" className="mt-2 text-xs font-semibold text-red-700">
          {t("actionFailed")}
        </p>
      )}
      <label className="mt-3 block">
        <span className="mb-1 block text-xs font-semibold text-ink">{t("proofReference")} *</span>
        <input
          name="reference"
          required
          maxLength={200}
          className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm"
        />
      </label>
      <label className="mt-3 block">
        <span className="mb-1 block text-xs font-semibold text-ink">{t("proofFile")} *</span>
        <input
          type="file"
          name="proof"
          required
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="block w-full text-xs text-muted file:mr-3 file:rounded-full file:border-0 file:bg-forest file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
        />
      </label>
      <button type="submit" disabled={pending} className="btn btn-primary mt-3 min-h-10 px-4 text-xs disabled:opacity-60">
        {t("submitProof")}
      </button>
    </form>
  );
}
