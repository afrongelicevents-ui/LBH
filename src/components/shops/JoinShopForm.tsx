"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { applyShop, type ShopResult } from "@/app/actions/shops";
import { guardAction, useSubmitKeepingValues } from "@/lib/useSubmitKeepingValues";
import { SHOP_CATEGORIES } from "@/config/shops";

const input = "mt-1 w-full rounded-[10px] border border-rule bg-paper px-3 py-2.5 text-[15px] font-normal";
const label = "block text-sm font-semibold text-charcoal";

export default function JoinShopForm() {
  const t = useTranslations("shops.joinPage");
  const tc = useTranslations("shops.cat");
  const [state, action, pending] = useActionState(guardAction(applyShop, { ok: false, error: "error" } as ShopResult), null);
  const submit = useSubmitKeepingValues(action);
  if (state?.ok)
    return (
      <p role="status" className="card mt-6 p-5 font-semibold text-forest" data-testid="shop-join-done">
        {t("done")}
      </p>
    );
  return (
    <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2" data-testid="shop-join-form">
      <label className={label}>{t("name")}<input name="name" required maxLength={100} className={input} /></label>
      <label className={label}>{t("area")}<input name="area" required maxLength={80} className={input} /></label>
      <label className={`${label} sm:col-span-2`}>{t("address")}<input name="address" maxLength={200} className={input} /></label>
      <label className={label}>{t("contact")}<input name="contact_name" required maxLength={100} autoComplete="name" className={input} /></label>
      <label className={label}>{t("phone")}<input name="phone" required maxLength={40} inputMode="tel" autoComplete="tel" className={input} /></label>
      <label className={`${label} sm:col-span-2`}>{t("email")}<input name="email" type="email" maxLength={254} autoComplete="email" className={input} /></label>
      <fieldset className="sm:col-span-2">
        <legend className={label}>{t("cats")}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {SHOP_CATEGORIES.map((c) => (
            <label key={c} className="inline-flex items-center gap-2 rounded-full border border-rule bg-paper px-3 py-1.5 text-sm">
              <input type="checkbox" name="categories" value={c} className="h-4 w-4 accent-forest" />
              {tc(c)}
            </label>
          ))}
        </div>
      </fieldset>
      <label className={`${label} sm:col-span-2`}>
        {t("notes")}
        <textarea name="notes" rows={4} maxLength={4000} placeholder={t("notesPh")} className={input} />
      </label>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      <label className="flex items-start gap-3 text-[15px] font-semibold text-charcoal sm:col-span-2">
        <input type="checkbox" name="agree" required className="mt-0.5 h-5 w-5 accent-forest" data-testid="shop-join-agree" />
        {t("agree")}
      </label>
      {state && !state.ok && (
        <p role="alert" className="text-sm font-semibold text-red-700 sm:col-span-2">{t(`errors.${state.error}` as never)}</p>
      )}
      <button type="submit" disabled={pending} className="ds-btn ds-btn-primary sm:col-span-2 sm:justify-self-start disabled:opacity-60">
        {pending ? t("sending") : t("submit")}
      </button>
    </form>
  );
}
