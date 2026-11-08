"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { addMoney, type BaResult } from "@/app/[locale]/portal/build-account/actions";
import { useSubmitKeepingValues } from "@/lib/useSubmitKeepingValues";

const inputCls = "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink focus:border-forest focus:outline-none";
const labelCls = "mb-1 block text-xs font-semibold text-ink";
const SERVICES = ["mukuru", "worldremit", "remitly", "bank", "card", "cash", "other"] as const;

/** Log money sent: stays "On its way" until the receiver confirms it. */
export default function AddMoneyForm({
  ownerId,
  accounts,
  today,
}: {
  ownerId: string;
  accounts: { id: string; name: string; receiver: string }[];
  today: string;
}) {
  const t = useTranslations("ba");
  const router = useRouter();
  const [state, formAction, pending] = useActionState<BaResult | null, FormData>(async (prev, fd) => {
    try {
      const r = await addMoney(ownerId, prev, fd);
      if (r.ok) router.push("/portal/build-account?added=1");
      return r;
    } catch {
      return { ok: false, error: "network" };
    }
  }, null);
  const submit = useSubmitKeepingValues(formAction);
  return (
    <form onSubmit={submit} className="card space-y-3 p-4" data-testid="ba-add-form">
      <label className="block">
        <span className={labelCls}>{t("toAccount")} *</span>
        <select name="account_id" required defaultValue={accounts[0]?.id} className={inputCls}>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} — {a.receiver}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className={labelCls}>{t("sentWith")} *</span>
        <select name="service" required defaultValue="" className={inputCls}>
          <option value="" disabled>—</option>
          {SERVICES.map((s) => (
            <option key={s} value={s}>
              {t(`service.${s}`)}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={labelCls}>{t("amountSent")} (USD) *</span>
          <input name="amount" required inputMode="decimal" placeholder="0.00" className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>{t("sendingFee")} (USD)</span>
          <input name="fee" inputMode="decimal" placeholder="0.00" className={inputCls} />
        </label>
      </div>
      <label className="block">
        <span className={labelCls}>{t("date")} *</span>
        <input name="occurred_on" type="date" required defaultValue={today} className={inputCls} />
      </label>
      <label className="block">
        <span className={labelCls}>{t("note")}</span>
        <input name="description" maxLength={300} placeholder={t("notePlaceholder")} className={inputCls} />
      </label>
      <p className="rounded-xl bg-prog-soft p-2.5 text-xs text-ink">{t("onItsWayHint")}</p>
      <button type="submit" disabled={pending} className="btn btn-green w-full disabled:opacity-60" data-testid="ba-add-submit">
        {t("logTransfer")}
      </button>
      {state && !state.ok && <p role="alert" className="text-sm font-bold text-red-700">{t(`error.${state.error}` as never)}</p>}
    </form>
  );
}
