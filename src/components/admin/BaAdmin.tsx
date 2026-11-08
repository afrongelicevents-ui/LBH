"use client";

import { useActionState, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useSubmitKeepingValues, guardAction } from "@/lib/useSubmitKeepingValues";
import {
  saveBaSettings,
  setBaOverride,
  confirmLbhTransfer,
  sendBaReminders,
  savePriceItem,
  deletePriceItem,
  type BaAdminResult,
} from "@/app/[locale]/admin/settings/build-account/actions";

const inputCls = "w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink focus:border-forest focus:outline-none";
const labelCls = "mb-1 block text-xs font-semibold text-ink";
const OFFLINE: BaAdminResult = { ok: false, error: "error" };

function Msg({ r, okText }: { r: BaAdminResult | null; okText?: string }) {
  const t = useTranslations("admin.ba");
  if (!r) return null;
  if (r.ok) return okText ? <p role="status" className="text-sm font-bold text-forest">{okText}</p> : null;
  return (
    <p role="alert" className="text-sm font-bold text-red-700">
      {t(`error.${r.error}` as never)}
    </p>
  );
}

const dollars = (c: number | null) => (c ? (c / 100).toFixed(2) : "");

export function BaSettingsForm({ enabled, monthly, yearly }: { enabled: boolean; monthly: number | null; yearly: number | null }) {
  const t = useTranslations("admin.ba");
  const [state, action, pending] = useActionState(guardAction(saveBaSettings, OFFLINE), null);
  const submit = useSubmitKeepingValues(action);
  return (
    <form onSubmit={submit} className="card space-y-4 p-5" data-testid="ba-settings-form">
      <h2 className="text-base font-extrabold text-ink">{t("pricesTitle")}</h2>
      <label className="flex items-center gap-2 text-sm font-semibold text-ink">
        <input type="checkbox" name="enabled" defaultChecked={enabled} className="h-5 w-5 accent-forest" />
        {t("enabled")}
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className={labelCls}>{t("monthly")}</span>
          <input name="monthly" inputMode="decimal" defaultValue={dollars(monthly)} className={inputCls} data-testid="ba-monthly" />
        </label>
        <label>
          <span className={labelCls}>{t("yearly")}</span>
          <input name="yearly" inputMode="decimal" defaultValue={dollars(yearly)} className={inputCls} placeholder={t("optional")} />
        </label>
      </div>
      <p className="text-xs text-muted">{t("freeRule")}</p>
      <Msg r={state} okText={t("saved")} />
      <button type="submit" disabled={pending} className="btn btn-green disabled:opacity-60" data-testid="ba-settings-save">
        {t("save")}
      </button>
    </form>
  );
}

export function OverrideControl({ ownerId, current, until }: { ownerId: string; current: string | null; until: string | null }) {
  const t = useTranslations("admin.ba");
  const [mode, setMode] = useState(current ?? "auto");
  const [date, setDate] = useState(until ? until.slice(0, 10) : "");
  const [pending, start] = useTransition();
  const [r, setR] = useState<BaAdminResult | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid={`override-${ownerId}`}>
      <select value={mode} onChange={(e) => setMode(e.target.value)} className="rounded-lg border border-line bg-white px-2 py-1.5 text-sm" aria-label={t("override")}>
        {["auto", "free", "paid", "expired"].map((m) => (
          <option key={m} value={m}>
            {t(`ov.${m}`)}
          </option>
        ))}
      </select>
      {mode === "paid" && (
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label={t("until")} className="rounded-lg border border-line bg-white px-2 py-1.5 text-sm" />
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            try {
              setR(await setBaOverride(ownerId, mode, mode === "paid" ? date : "", ""));
            } catch {
              setR(OFFLINE);
            }
          })
        }
        className="rounded-lg bg-forest px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
      >
        {t("apply")}
      </button>
      <Msg r={r} okText={t("saved")} />
    </div>
  );
}

export function LbhTransferButtons({ entryId }: { entryId: string }) {
  const t = useTranslations("admin.ba");
  const [pending, start] = useTransition();
  const [r, setR] = useState<BaAdminResult | null>(null);
  const go = (approve: boolean) =>
    start(async () => {
      try {
        setR(await confirmLbhTransfer(entryId, approve));
      } catch {
        setR(OFFLINE);
      }
    });
  return (
    <span className="flex flex-wrap items-center gap-2">
      <button type="button" disabled={pending} onClick={() => go(true)} className="rounded-lg bg-forest px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60" data-testid="lbh-received">
        {t("received")}
      </button>
      <button type="button" disabled={pending} onClick={() => go(false)} className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-red-700 shadow-sm disabled:opacity-60">
        {t("notReceived")}
      </button>
      <Msg r={r} />
    </span>
  );
}

export function RemindersButton() {
  const t = useTranslations("admin.ba");
  const [pending, start] = useTransition();
  const [r, setR] = useState<BaAdminResult | null>(null);
  return (
    <span className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            try {
              setR(await sendBaReminders());
            } catch {
              setR(OFFLINE);
            }
          })
        }
        className="btn-details disabled:opacity-60"
      >
        {t("sendReminders")}
      </button>
      {r?.ok && <span role="status" className="text-sm font-bold text-forest">{t("remindersSent", { count: r.count ?? 0 })}</span>}
      <Msg r={r} />
    </span>
  );
}

export function PriceItemForm({ item }: { item?: { id: string; item: string; unit: string; area: string; price_cents: number } }) {
  const t = useTranslations("admin.ba");
  const [state, action, pending] = useActionState(guardAction(savePriceItem.bind(null, item?.id ?? null), OFFLINE), null);
  const submit = useSubmitKeepingValues(action);
  return (
    <form onSubmit={submit} className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_1fr_auto] sm:items-end" data-testid={item ? `price-edit-${item.id}` : "price-add"}>
      <label>
        <span className={labelCls}>{t("item")}</span>
        <input name="item" required defaultValue={item?.item} className={inputCls} />
      </label>
      <label>
        <span className={labelCls}>{t("unit")}</span>
        <input name="unit" required defaultValue={item?.unit} className={inputCls} placeholder={t("unitHint")} />
      </label>
      <label>
        <span className={labelCls}>{t("area")}</span>
        <input name="area" required defaultValue={item?.area} className={inputCls} placeholder={t("areaHint")} />
      </label>
      <label>
        <span className={labelCls}>{t("price")}</span>
        <input name="price" required inputMode="decimal" defaultValue={dollars(item?.price_cents ?? null)} className={inputCls} />
      </label>
      <button type="submit" disabled={pending} className="btn btn-green min-h-10 disabled:opacity-60">
        {item ? t("save") : t("add")}
      </button>
      <div className="sm:col-span-5">
        <Msg r={state} okText={item ? t("saved") : t("added")} />
      </div>
    </form>
  );
}

export function DeletePriceButton({ id }: { id: string }) {
  const t = useTranslations("admin.ba");
  const [pending, start] = useTransition();
  const [r, setR] = useState<BaAdminResult | null>(null);
  return (
    <span>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm(t("deleteConfirm"))) return;
          start(async () => {
            try {
              setR(await deletePriceItem(id));
            } catch {
              setR(OFFLINE);
            }
          });
        }}
        className="text-xs font-bold text-red-700 disabled:opacity-60"
      >
        {t("delete")}
      </button>
      <Msg r={r} />
    </span>
  );
}
