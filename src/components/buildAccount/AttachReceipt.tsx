"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useDirectUpload } from "@/lib/useDirectUpload";
import { attachReceipt } from "@/app/[locale]/account/(customer)/build-account/actions";

/** Add a receipt photo to money already spent. */
export default function AttachReceipt({ ownerId, entryId }: { ownerId: string; entryId: string }) {
  const t = useTranslations("ba");
  const ref = useRef<HTMLInputElement>(null);
  const { upload } = useDirectUpload();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  function onFile(f: File | undefined) {
    if (!f) return;
    start(async () => {
      try {
        const up = await upload("ba-receipt", [f]);
        if (!up.ok || !up.refs.length) return setMsg(t("error.upload"));
        const fd = new FormData();
        fd.set("uploads_json", JSON.stringify(up.refs));
        const r = await attachReceipt(ownerId, entryId, fd);
        setMsg(r.ok ? t("receiptAdded") : t(`error.${r.error}` as never));
      } catch {
        setMsg(t("error.network"));
      }
    });
  }
  return (
    <span className="inline-flex items-center gap-2">
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} aria-label={t("addReceipt")} />
      <button type="button" disabled={pending} onClick={() => ref.current?.click()} className="text-xs font-bold text-forest underline underline-offset-2">
        {pending ? t("uploading") : t("addReceipt")}
      </button>
      {msg && <span role="status" className="text-xs font-semibold text-muted">{msg}</span>}
    </span>
  );
}
