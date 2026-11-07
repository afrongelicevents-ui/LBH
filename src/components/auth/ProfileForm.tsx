"use client";

import { useSubmitKeepingValues } from "@/lib/useSubmitKeepingValues";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { updateMyProfile, type ProfileResult } from "@/app/[locale]/(site)/account/actions";

const inputCls =
  "w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink focus:border-forest focus:outline-none";
const labelCls = "mb-1.5 block text-sm font-semibold text-ink";

export default function ProfileForm({
  defaults,
}: {
  defaults: { full_name: string; whatsapp: string; country: string };
}) {
  const t = useTranslations("account");
  const tb = useTranslations("bookPage");
  const [state, formAction, pending] = useActionState<ProfileResult | null, FormData>(updateMyProfile, null);
  const submitKeepingValues = useSubmitKeepingValues(formAction);
  return (
    <form onSubmit={submitKeepingValues} className="space-y-4">
      <label className="block">
        <span className={labelCls}>{t("name")}</span>
        <input name="full_name" required minLength={2} maxLength={120} defaultValue={defaults.full_name} className={inputCls} />
      </label>
      <label className="block">
        <span className={labelCls}>{t("whatsapp")}</span>
        <input name="whatsapp" type="tel" defaultValue={defaults.whatsapp} placeholder={tb("whatsappHint")} className={inputCls} />
      </label>
      <label className="block">
        <span className={labelCls}>{t("country")}</span>
        <select name="country" defaultValue={defaults.country} className={inputCls}>
          <option value="">—</option>
          <option value="uk">{tb("countryUK")}</option>
          <option value="usa">{tb("countryUSA")}</option>
          <option value="sa">{tb("countrySA")}</option>
          <option value="zw">{t("countryZW")}</option>
          <option value="other">{tb("countryOther")}</option>
        </select>
      </label>
      <button type="submit" disabled={pending} className="btn btn-green w-full disabled:opacity-60">
        {t("save")}
      </button>
      {state?.ok && (
        <p role="status" className="text-sm font-bold text-forest">
          {t("saved")}
        </p>
      )}
      {state && !state.ok && (
        <p role="alert" className="text-sm font-bold text-red-700">
          {t(`error.${state.error}`)}
        </p>
      )}
    </form>
  );
}
