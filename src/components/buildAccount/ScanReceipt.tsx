"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useDirectUpload } from "@/lib/useDirectUpload";
import { readReceipt, saveSpend, type BaResult } from "@/app/[locale]/account/(customer)/build-account/actions";
import { useSubmitKeepingValues } from "@/lib/useSubmitKeepingValues";
import { CameraIcon } from "@/components/ui/PortalIcons";

const inputCls = "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink focus:border-forest focus:outline-none";
const labelCls = "mb-1 block text-xs font-semibold text-ink";

interface Item {
  name: string;
  qty: string;
  unit: string;
  total: string;
}
const dollars = (c: number | null | undefined) => (typeof c === "number" ? (c / 100).toFixed(2) : "");
const toCents = (s: string) => {
  const n = Number(String(s).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && s.trim() !== "" ? Math.round(n * 100) : undefined;
};

/**
 * Scan receipt → the photo is read (shop, items, total) → the person checks
 * and edits → chooses account + stage → "Confirm and deduct".
 * Without a photo it records money spent with "no receipt yet".
 */
export default function ScanReceipt({
  ownerId,
  ownerQs,
  accounts,
  stages,
  today,
}: {
  ownerId: string;
  ownerQs: string;
  accounts: { id: string; name: string; balance_cents: number }[];
  stages: string[];
  today: string;
}) {
  const t = useTranslations("ba");
  const router = useRouter();
  const [acct, setAcct] = useState(accounts[0]?.id ?? "");
  const camRef = useRef<HTMLInputElement>(null);
  const { upload } = useDirectUpload();
  const [reading, startReading] = useTransition();
  const [readErr, setReadErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [path, setPath] = useState("");
  const [read, setRead] = useState(false);
  const [shop, setShop] = useState("");
  const [date, setDate] = useState(today);
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState("");

  function onPhoto(f: File | undefined) {
    if (!f) return;
    setPreview(URL.createObjectURL(f));
    setReadErr(null);
    startReading(async () => {
      try {
        const up = await upload("ba-receipt", [f]);
        if (!up.ok || !up.refs.length) return setReadErr(up.ok ? "upload" : up.error === "size" ? "toobig" : up.error === "type" ? "filetype" : "upload");
        const fd = new FormData();
        fd.set("uploads_json", JSON.stringify(up.refs));
        const r = await readReceipt(ownerId, fd);
        if (!r.ok) return setReadErr(r.error);
        setPath(r.path);
        setRead(true);
        setShop(r.parsed.shop);
        if (r.parsed.date) setDate(r.parsed.date);
        setItems(r.parsed.items.map((i) => ({ name: i.name, qty: String(i.qty), unit: dollars(i.unit_cents), total: dollars(i.total_cents) })));
        setTotal(dollars(r.parsed.total_cents));
      } catch {
        setReadErr("network");
      }
    });
  }

  const itemsTotal = items.reduce((s, i) => s + (toCents(i.total) ?? 0), 0);
  const [state, formAction, pending] = useActionState<BaResult | null, FormData>(async (prev, fd) => {
    try {
      fd.set(
        "items_json",
        JSON.stringify(
          items
            .filter((i) => i.name.trim())
            .map((i) => ({ name: i.name.trim(), qty: Number(i.qty) || 1, unit_cents: toCents(i.unit), total_cents: toCents(i.total) }))
        )
      );
      const r = await saveSpend(ownerId, prev, fd);
      if (r.ok) router.push(`/account/build-account/statement${ownerQs}`);
      return r;
    } catch {
      return { ok: false, error: "network" };
    }
  }, null);
  const submit = useSubmitKeepingValues(formAction);

  return (
    <div className="space-y-4">
      <section className="card p-4">
        <input
          ref={camRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          className="hidden"
          aria-label={t("takePhoto")}
          data-testid="ba-receipt-input"
          onChange={(e) => onPhoto(e.target.files?.[0])}
        />
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => camRef.current?.click()} disabled={reading} className="btn btn-green min-h-11 text-sm">
            <CameraIcon size={18} />
            {preview ? t("retake") : t("takePhoto")}
          </button>
          {reading && <span className="text-sm font-semibold text-forest" role="status">{t("reading")}</span>}
          {read && !reading && <span className="text-sm font-semibold text-forest" role="status" data-testid="ba-read-done">{t("readDone")}</span>}
        </div>
        {readErr && <p role="alert" className="mt-2 text-sm font-bold text-red-700">{t(`error.${readErr}` as never)}</p>}
        {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
        {preview && <img src={preview} alt="" className="mt-3 max-h-72 rounded-xl border border-line object-contain" />}
        <p className="mt-2 text-xs text-muted">{t("scanHint")}</p>
      </section>

      <form onSubmit={submit} className="card space-y-3 p-4" data-testid="ba-spend-form">
        <input type="hidden" name="receipt_path" value={path} />
        <input type="hidden" name="source" value={path ? "scan" : "manual"} />
        <h2 className="text-base font-extrabold text-ink">{t("checkDetails")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={labelCls}>{t("shop")}</span>
            <input name="shop" value={shop} onChange={(e) => setShop(e.target.value)} maxLength={120} className={inputCls} />
          </label>
          <label className="block">
            <span className={labelCls}>{t("date")} *</span>
            <input name="occurred_on" type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </label>
        </div>

        <div>
          <span className={labelCls}>{t("items")}</span>
          <ul className="space-y-2">
            {items.map((it, i) => (
              <li key={i} className="grid grid-cols-[1fr_3.5rem_5rem_5rem_2rem] items-center gap-1.5">
                <input aria-label={t("itemName")} value={it.name} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className={`${inputCls} min-w-0 px-2`} />
                <input aria-label={t("qty")} value={it.qty} inputMode="decimal" onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} className={`${inputCls} min-w-0 px-2`} />
                <input aria-label={t("unitPrice")} value={it.unit} inputMode="decimal" onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)))} className={`${inputCls} min-w-0 px-2`} />
                <input aria-label={t("lineTotal")} value={it.total} inputMode="decimal" onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, total: e.target.value } : x)))} className={`${inputCls} min-w-0 px-2`} />
                <button type="button" aria-label={t("removeItem")} onClick={() => setItems(items.filter((_, j) => j !== i))} className="text-lg text-muted">
                  ×
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[11px] text-muted">{t("itemsCols")}</p>
          <button type="button" onClick={() => setItems([...items, { name: "", qty: "1", unit: "", total: "" }])} className="mt-2 text-sm font-bold text-forest underline">
            + {t("addItem")}
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className={labelCls}>{t("total")} (USD) *</span>
            <input name="amount" required inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} className={inputCls} data-testid="ba-total" />
            {itemsTotal > 0 && toCents(total) !== itemsTotal && (
              <button type="button" onClick={() => setTotal((itemsTotal / 100).toFixed(2))} className="mt-1 text-[11px] font-bold text-forest underline">
                {t("useItemsTotal", { amount: (itemsTotal / 100).toFixed(2) })}
              </button>
            )}
          </label>
          <label className="block">
            <span className={labelCls}>{t("fromAccount")} *</span>
            <select name="account_id" required value={acct} onChange={(e) => setAcct(e.target.value)} className={inputCls}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>{t("stage")}</span>
            <select name="stage_name" defaultValue="" className={inputCls}>
              <option value="">—</option>
              {stages.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>
        {(() => {
          const bal = accounts.find((a) => a.id === acct)?.balance_cents ?? 0;
          const after = bal - (toCents(total) ?? 0);
          return (
            <p className="flex items-center justify-between rounded-xl bg-ok-soft px-3 py-2.5 text-sm" data-testid="ba-balance-after">
              <span className="font-semibold text-ink">{t("balanceAfter")}</span>
              <strong className={`text-lg ${after < 0 ? "text-red-700" : "text-forest"}`}>
                {after < 0 ? "−" : ""}${(Math.abs(after) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </strong>
            </p>
          );
        })()}
        <label className="block">
          <span className={labelCls}>{t("note")}</span>
          <input name="description" maxLength={300} className={inputCls} />
        </label>
        {!path && <p className="rounded-xl bg-prog-soft p-2.5 text-xs text-ink">{t("noPhotoWarning")}</p>}
        <button type="submit" disabled={pending || reading} className="btn btn-green w-full disabled:opacity-60" data-testid="ba-confirm-deduct">
          {t("confirmDeduct")}
        </button>
        {state && !state.ok && (
          <p role="alert" className="text-sm font-bold text-red-700">
            {t(`error.${state.error}` as never)}
          </p>
        )}
      </form>
    </div>
  );
}
