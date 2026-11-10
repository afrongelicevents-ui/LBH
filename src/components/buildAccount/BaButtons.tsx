"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { confirmTransfer, deleteEntry } from "@/app/[locale]/account/(customer)/build-account/actions";

/** "Money arrived" / "Not received" for the person who receives a transfer. */
export function ConfirmTransferButtons({ ownerId, entryId }: { ownerId: string; entryId: string }) {
  const t = useTranslations("ba");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const run = (approve: boolean) =>
    start(async () => {
      setErr(null);
      try {
        const r = await confirmTransfer(ownerId, entryId, approve);
        if (!r.ok) setErr(r.error);
      } catch {
        setErr("network");
      }
    });
  return (
    <span className="flex flex-wrap items-center gap-2">
      <button type="button" disabled={pending} onClick={() => run(true)} className="btn-details min-h-9 px-3 py-1 text-xs disabled:opacity-60" data-testid="confirm-arrived">
        {t("arrived")}
      </button>
      <button type="button" disabled={pending} onClick={() => run(false)} className="text-xs font-bold text-red-700 underline">
        {t("notReceived")}
      </button>
      {err && <span role="alert" className="text-xs font-bold text-red-700">{t(`error.${err}` as never)}</span>}
    </span>
  );
}

export function DeleteEntryButton({ ownerId, entryId }: { ownerId: string; entryId: string }) {
  const t = useTranslations("ba");
  const [pending, start] = useTransition();
  const [sure, setSure] = useState(false);
  if (!sure) {
    return (
      <button type="button" onClick={() => setSure(true)} className="text-[11px] font-semibold text-muted underline">
        {t("delete")}
      </button>
    );
  }
  return (
    <span className="flex items-center gap-2 text-[11px]">
      {t("deleteSure")}
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => void (await deleteEntry(ownerId, entryId).catch(() => null)))}
        className="font-bold text-red-700 underline"
      >
        {t("yesDelete")}
      </button>
      <button type="button" onClick={() => setSure(false)} className="font-bold text-forest underline">
        {t("cancel")}
      </button>
    </span>
  );
}
