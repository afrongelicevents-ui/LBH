"use client";

import { useActionState, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { guardAction, useSubmitKeepingValues } from "@/lib/useSubmitKeepingValues";
import { SHOP_CATEGORIES } from "@/config/shops";
import {
  saveShop,
  setShopStatus,
  setShopWarnings,
  saveShopItem,
  toggleShopItemStock,
  deleteShopItem,
  assignShopOrder,
  adminCancelShopOrder,
  type ShopAdminResult,
} from "@/app/[locale]/admin/shops/actions";

const inputCls = "w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm text-ink focus:border-forest focus:outline-none";
const labelCls = "mb-1 block text-xs font-semibold text-ink";
const OFFLINE: ShopAdminResult = { ok: false, error: "db" };

function Msg({ r, okText }: { r: ShopAdminResult | null; okText?: string }) {
  const t = useTranslations("shops.admin");
  if (!r) return null;
  if (r.ok) return okText ? <p role="status" className="text-sm font-bold text-forest">{okText}</p> : null;
  return <p role="alert" className="text-sm font-bold text-red-700">{t(`errors.${["agreement", "invalid", "auth"].includes(r.error) ? r.error : "db"}` as never)}</p>;
}

export interface AdminShop {
  id: string;
  name: string;
  area: string;
  address: string;
  about: string;
  categories: string[];
  fair_price_agreed_at: string | null;
  contact_name: string;
  phone: string;
  email: string;
  notes: string;
}

/** Add / edit a shop: public details + private contact + fair-price agreement. */
export function ShopForm({ shop }: { shop?: AdminShop }) {
  const t = useTranslations("shops.admin");
  const tj = useTranslations("shops.joinPage");
  const tc = useTranslations("shops.cat");
  const router = useRouter();
  const [state, action, pending] = useActionState(
    guardAction(async (prev: ShopAdminResult | null, fd: FormData) => {
      const r = await saveShop(shop?.id ?? null, prev, fd);
      if (r.ok && !shop && r.id) router.push(`/admin/shops/${r.id}`);
      return r;
    }, OFFLINE),
    null
  );
  const submit = useSubmitKeepingValues(action);
  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2" data-testid={shop ? "shop-edit-form" : "shop-add-form"}>
      <label><span className={labelCls}>{tj("name")}</span><input name="name" required defaultValue={shop?.name} className={inputCls} /></label>
      <label><span className={labelCls}>{tj("area")}</span><input name="area" defaultValue={shop?.area} className={inputCls} /></label>
      <label className="sm:col-span-2"><span className={labelCls}>{tj("address")}</span><input name="address" defaultValue={shop?.address} className={inputCls} /></label>
      <label className="sm:col-span-2"><span className={labelCls}>{t("about")}</span><textarea name="about" rows={2} maxLength={600} defaultValue={shop?.about} className={inputCls} /></label>
      <fieldset className="sm:col-span-2">
        <legend className={labelCls}>{tj("cats")}</legend>
        <div className="flex flex-wrap gap-2">
          {SHOP_CATEGORIES.map((c) => (
            <label key={c} className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs">
              <input type="checkbox" name="categories" value={c} defaultChecked={shop?.categories.includes(c)} className="accent-forest" />
              {tc(c)}
            </label>
          ))}
        </div>
      </fieldset>
      <p className="text-xs font-extrabold text-ink sm:col-span-2">{t("contactPrivate")}</p>
      <label><span className={labelCls}>{tj("contact")}</span><input name="contact_name" defaultValue={shop?.contact_name} className={inputCls} /></label>
      <label><span className={labelCls}>{tj("phone")}</span><input name="phone" defaultValue={shop?.phone} className={inputCls} /></label>
      <label className="sm:col-span-2"><span className={labelCls}>{tj("email")}</span><input name="email" defaultValue={shop?.email} className={inputCls} /></label>
      <label className="sm:col-span-2"><span className={labelCls}>{tj("notes")}</span><textarea name="notes" rows={3} defaultValue={shop?.notes} className={inputCls} /></label>
      <label className="flex items-center gap-2 text-sm font-semibold text-ink sm:col-span-2">
        <input type="checkbox" name="agreed" defaultChecked={Boolean(shop?.fair_price_agreed_at)} className="h-5 w-5 accent-forest" data-testid="shop-agreed" />
        {t("agreed")}
      </label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={pending} className="btn btn-green disabled:opacity-60" data-testid="shop-save">{shop ? t("save") : t("add")}</button>
        <Msg r={state} okText={t("saved")} />
      </div>
    </form>
  );
}

function useRun() {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [r, setR] = useState<ShopAdminResult | null>(null);
  const run = (fn: () => Promise<ShopAdminResult>) =>
    start(async () => {
      const res = await fn().catch(() => OFFLINE);
      setR(res);
      if (res.ok) router.refresh();
    });
  return { busy, r, run };
}

export function ShopStatusButtons({ id, status, warnings }: { id: string; status: string; warnings: number }) {
  const t = useTranslations("shops.admin");
  const { busy, r, run } = useRun();
  const b = "btn min-h-10 disabled:opacity-60";
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {status !== "approved" && <button disabled={busy} onClick={() => run(() => setShopStatus(id, "approved"))} className={`${b} btn-green`} data-testid="shop-approve">{t("approve")}</button>}
        {status !== "suspended" && <button disabled={busy} onClick={() => run(() => setShopStatus(id, "suspended"))} className={`${b} btn-outline-green`} data-testid="shop-suspend">{t("suspend")}</button>}
        {status === "suspended" && <button disabled={busy} onClick={() => run(() => setShopStatus(id, "pending"))} className={`${b} btn-outline-green`}>{t("reopen")}</button>}
        <button disabled={busy} onClick={() => run(() => setShopWarnings(id, "add"))} className={`${b} btn-outline-green`} data-testid="shop-warn">{t("addWarning")}</button>
        {warnings > 0 && <button disabled={busy} onClick={() => run(() => setShopWarnings(id, "reset"))} className={`${b} btn-outline-green`}>{t("resetWarnings")}</button>}
      </div>
      <Msg r={r} />
    </div>
  );
}

export function ShopItemForm({ shopId, item }: { shopId: string; item?: { id: string; name: string; category: string; unit: string; price_cents: number; in_stock: boolean } }) {
  const t = useTranslations("shops.admin");
  const tc = useTranslations("shops.cat");
  const [state, action, pending] = useActionState(guardAction(saveShopItem.bind(null, shopId, item?.id ?? null), OFFLINE), null);
  const submit = useSubmitKeepingValues(action);
  return (
    <form onSubmit={submit} className="grid gap-2 sm:grid-cols-[2fr_1.3fr_1fr_0.8fr_auto] sm:items-end" data-testid={item ? "shop-item-edit" : "shop-item-add"}>
      <label><span className={labelCls}>{t("item")}</span><input name="name" required defaultValue={item?.name} className={inputCls} /></label>
      <label>
        <span className={labelCls}>{t("category")}</span>
        <select name="category" defaultValue={item?.category ?? "cement"} className={inputCls}>
          {SHOP_CATEGORIES.map((c) => <option key={c} value={c}>{tc(c)}</option>)}
        </select>
      </label>
      <label><span className={labelCls}>{t("unit")}</span><input name="unit" required defaultValue={item?.unit} placeholder={t("unitHint")} className={inputCls} /></label>
      <label><span className={labelCls}>{t("price")}</span><input name="price" required inputMode="decimal" defaultValue={item ? (item.price_cents / 100).toFixed(2) : ""} className={inputCls} /></label>
      <input type="hidden" name="in_stock" value={item && !item.in_stock ? "off" : "on"} />
      <button type="submit" disabled={pending} className="btn btn-green min-h-10 disabled:opacity-60">{item ? t("save") : t("addItem")}</button>
      <div className="sm:col-span-5"><Msg r={state} okText={t("saved")} /></div>
    </form>
  );
}

export function ShopItemButtons({ id, inStock }: { id: string; inStock: boolean }) {
  const t = useTranslations("shops.admin");
  const { busy, r, run } = useRun();
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <label className="flex items-center gap-2 font-semibold">
        <input type="checkbox" checked={inStock} disabled={busy} onChange={(e) => run(() => toggleShopItemStock(id, e.target.checked))} className="h-4 w-4 accent-forest" />
        {t("inStock")}
      </label>
      <button disabled={busy} onClick={() => run(() => deleteShopItem(id))} className="font-semibold text-red-700 underline">{t("delete")}</button>
      <Msg r={r} />
    </div>
  );
}

export function AssignOrder({ orderId, current, pms, canCancel }: { orderId: string; current: string | null; pms: { id: string; name: string }[]; canCancel: boolean }) {
  const t = useTranslations("shops.admin");
  const { busy, r, run } = useRun();
  const [pm, setPm] = useState(current ?? pms[0]?.id ?? "");
  return (
    <div className="flex flex-wrap items-end gap-2">
      {pms.length === 0 ? (
        <p className="text-sm text-muted">{t("noPms")}</p>
      ) : (
        <>
          <label>
            <span className={labelCls}>{t("assignTo")}</span>
            <select value={pm} onChange={(e) => setPm(e.target.value)} className={inputCls} data-testid="order-pm">
              {pms.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <button disabled={busy || !pm} onClick={() => run(() => assignShopOrder(orderId, pm))} className="btn btn-green min-h-10 disabled:opacity-60" data-testid="order-assign">{t("assign")}</button>
        </>
      )}
      {canCancel && <button disabled={busy} onClick={() => run(() => adminCancelShopOrder(orderId))} className="btn btn-outline-green min-h-10 disabled:opacity-60">{t("cancelOrder")}</button>}
      <div className="w-full"><Msg r={r} /></div>
    </div>
  );
}
