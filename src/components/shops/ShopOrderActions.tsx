"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { acceptShopChange, cancelShopOrder } from "@/app/actions/shops";

/** Client buttons on a shop order: accept the changes / cancel. */
export function ClientOrderActions({ id, status }: { id: string; status: string }) {
  const t = useTranslations("shops.orders");
  const router = useRouter();
  const [busy, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  if (!["placed", "assigned", "changed"].includes(status)) return null;
  const run = (fn: (id: string) => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const r = await fn(id).catch(() => ({ ok: false, error: "error" }));
      if (r.ok) router.refresh();
      else setErr(r.error ?? "error");
    });
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {status === "changed" && (
        <button type="button" disabled={busy} onClick={() => run(acceptShopChange)} className="ds-btn ds-btn-primary disabled:opacity-60" data-testid="shop-order-accept">
          {t("accept")}
        </button>
      )}
      <button type="button" disabled={busy} onClick={() => run(cancelShopOrder)} className="ds-btn ds-btn-outline disabled:opacity-60" data-testid="shop-order-cancel">
        {t("cancel")}
      </button>
      {err && <p role="alert" className="w-full text-sm font-semibold text-red-700">{t(`errors.${err === "state" || err === "auth" ? err : "error"}` as never)}</p>}
    </div>
  );
}
