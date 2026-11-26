"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useDirectUpload } from "@/lib/useDirectUpload";
import { reportShopOrder, type FieldShopResult } from "@/app/[locale]/field/shop-orders/actions";
import { formatCents, parseDollarsToCents } from "@/lib/money";

type Line = { id: string; name: string; unit: string; qty: number; price_cents: number };

/** At the shop: check each price, untick what's missing, add the receipt photo, save. */
export default function FieldOrderForm({ orderId, items }: { orderId: string; items: Line[] }) {
  const t = useTranslations("shops.field");
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const { upload, uploading } = useDirectUpload();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    // Does the client have to decide first? (missing item or a higher price)
    const needsClient = items.some((i) => {
      if (fd.get(`avail_${i.id}`) !== "on") return true;
      const raw = String(fd.get(`shelf_${i.id}`) ?? "").trim();
      const c = raw ? parseDollarsToCents(raw) : null;
      return c !== null && c > i.price_cents;
    });
    const file = fd.get("receipt") as File | null;
    fd.delete("receipt");
    start(async () => {
      if (!needsClient) {
        if (!file || !file.size) return setMsg({ ok: false, text: t("errors.receipt") });
        const up = await upload("staff-media", [file]);
        if (!up.ok || !up.refs.length) return setMsg({ ok: false, text: t("errors.upload") });
        fd.set("uploads_json", JSON.stringify(up.refs));
      }
      const r: FieldShopResult = await reportShopOrder(orderId, null, fd).catch(() => ({ ok: false, error: "error" }) as FieldShopResult);
      if (r.ok) {
        setMsg({ ok: true, text: t(r.status) });
        router.refresh();
      } else setMsg({ ok: false, text: t(`errors.${r.error}` as never) });
    });
  };

  return (
    <form ref={form} onSubmit={submit} className="card space-y-4 p-5" data-testid="field-shop-form">
      <p className="rounded-xl bg-paper p-3 text-sm text-ink">{t("rules")}</p>
      <h2 className="text-base font-extrabold text-ink">{t("items")}</h2>
      <ul className="divide-y divide-[#eef0ef]">
        {items.map((i) => (
          <li key={i.id} className="grid gap-2 py-3 sm:grid-cols-[1fr_auto_auto] sm:items-center" data-testid="field-shop-line">
            <span className="text-sm">
              <strong className="text-ink">{i.qty} × {i.name}</strong>
              <span className="block text-muted">{i.unit} · {t("appPrice")} {formatCents(i.price_cents)}</span>
            </span>
            <label className="text-xs font-semibold text-ink">
              {t("shelf")}
              <input name={`shelf_${i.id}`} inputMode="decimal" placeholder={(i.price_cents / 100).toFixed(2)} className="mt-1 block w-32 rounded-xl border border-line bg-paper px-3 py-2 text-sm" data-testid="field-shelf" />
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-ink">
              <input type="checkbox" name={`avail_${i.id}`} defaultChecked className="h-5 w-5 accent-forest" data-testid="field-avail" />
              {t("there")}
            </label>
          </li>
        ))}
      </ul>
      <label className="block text-sm font-semibold text-ink">
        {t("receipt")} <span className="font-normal text-muted">· {t("receiptHint")}</span>
        <input type="file" name="receipt" accept="image/jpeg,image/png,image/webp" capture="environment" className="mt-1 block w-full text-sm" data-testid="field-receipt" />
      </label>
      <label className="block text-sm font-semibold text-ink">
        {t("note")}
        <textarea name="field_note" rows={2} maxLength={500} className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm font-normal" />
      </label>
      {msg && <p role={msg.ok ? "status" : "alert"} className={`text-sm font-bold ${msg.ok ? "text-forest" : "text-red-700"}`} data-testid="field-shop-msg">{msg.text}</p>}
      <button type="submit" disabled={busy || uploading} className="btn btn-green w-full disabled:opacity-60" data-testid="field-shop-save">
        {t("submit")}
      </button>
    </form>
  );
}
