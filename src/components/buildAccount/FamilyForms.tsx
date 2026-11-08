"use client";

import { useActionState, useTransition, useState } from "react";
import { useTranslations } from "next-intl";
import { inviteMember, updateMember, addAccount, type BaResult } from "@/app/[locale]/portal/build-account/actions";

const inputCls = "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink focus:border-forest focus:outline-none";
const labelCls = "mb-1 block text-xs font-semibold text-ink";

export function InviteForm() {
  const t = useTranslations("ba");
  const [state, formAction, pending] = useActionState<BaResult<{ link?: string; whatsappLink?: string }> | null, FormData>(
    async (prev, fd) => {
      try {
        return await inviteMember(prev, fd);
      } catch {
        return { ok: false, error: "network" };
      }
    },
    null
  );
  return (
    <form action={formAction} className="card space-y-3 p-4" data-testid="ba-invite-form">
      <h2 className="text-base font-extrabold text-ink">{t("inviteTitle")}</h2>
      <label className="block">
        <span className={labelCls}>{t("name")} *</span>
        <input name="name" required minLength={2} maxLength={80} className={inputCls} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={labelCls}>WhatsApp</span>
          <input name="whatsapp" type="tel" placeholder="+263 77 …" className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>{t("email")}</span>
          <input name="email" type="email" className={inputCls} />
        </label>
      </div>
      <fieldset>
        <legend className={labelCls}>{t("canDo")}</legend>
        <div className="flex flex-wrap gap-2">
          <label className="chip cursor-pointer has-checked:border-forest has-checked:bg-forest has-checked:text-white">
            <input type="radio" name="role" value="view" defaultChecked className="sr-only" />
            {t("role.view")}
          </label>
          <label className="chip cursor-pointer has-checked:border-forest has-checked:bg-forest has-checked:text-white">
            <input type="radio" name="role" value="add" className="sr-only" />
            {t("role.add")}
          </label>
        </div>
      </fieldset>
      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" name="holds_money" className="h-5 w-5 accent-[#163a2b]" />
        {t("holdsMoney")}
      </label>
      <button type="submit" disabled={pending} className="btn btn-green w-full disabled:opacity-60">
        {t("sendInvite")}
      </button>
      {state?.ok && (
        <div role="status" className="space-y-2 rounded-xl bg-ok-soft p-3 text-sm" data-testid="ba-invite-done">
          <p className="font-bold text-forest">{t("inviteReady")}</p>
          {state.whatsappLink && (
            <a href={state.whatsappLink} target="_blank" rel="noopener noreferrer" className="btn btn-green min-h-10 text-sm">
              {t("shareWhatsapp")}
            </a>
          )}
          <p className="text-xs break-all text-muted">{state.link}</p>
        </div>
      )}
      {state && !state.ok && <p role="alert" className="text-sm font-bold text-red-700">{t(`error.${state.error}` as never)}</p>}
    </form>
  );
}

export function MemberControls({ memberId, role }: { memberId: string; role: string }) {
  const t = useTranslations("ba");
  const [pending, start] = useTransition();
  const [sure, setSure] = useState(false);
  return (
    <span className="flex flex-wrap items-center gap-2 text-xs">
      <select
        aria-label={t("canDo")}
        defaultValue={role}
        disabled={pending}
        onChange={(e) => start(async () => void (await updateMember(memberId, { role: e.target.value as "view" | "add" }).catch(() => null)))}
        className="rounded-lg border border-line bg-white px-2 py-1"
      >
        <option value="view">{t("role.view")}</option>
        <option value="add">{t("role.add")}</option>
      </select>
      {sure ? (
        <button type="button" disabled={pending} onClick={() => start(async () => void (await updateMember(memberId, { remove: true }).catch(() => null)))} className="font-bold text-red-700 underline">
          {t("yesRemove")}
        </button>
      ) : (
        <button type="button" onClick={() => setSure(true)} className="font-bold text-muted underline">
          {t("remove")}
        </button>
      )}
    </span>
  );
}

export function AddAccountForm({ members }: { members: { id: string; name: string }[] }) {
  const t = useTranslations("ba");
  const [state, formAction, pending] = useActionState<BaResult | null, FormData>(async (prev, fd) => {
    try {
      return await addAccount(prev, fd);
    } catch {
      return { ok: false, error: "network" };
    }
  }, null);
  return (
    <form action={formAction} className="card space-y-3 p-4">
      <h2 className="text-base font-extrabold text-ink">{t("addAccountTitle")}</h2>
      <p className="text-xs text-muted">{t("addAccountHint")}</p>
      <label className="block">
        <span className={labelCls}>{t("accountName")} *</span>
        <input name="name" required minLength={2} maxLength={80} placeholder={t("accountNamePlaceholder")} className={inputCls} />
      </label>
      <label className="block">
        <span className={labelCls}>{t("whoHoldsIt")}</span>
        <select name="holder_member_id" defaultValue="" className={inputCls}>
          <option value="">{t("holderMe")}</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={pending} className="btn btn-outline-green min-h-10 text-sm">
        {t("addAccount")}
      </button>
      {state?.ok && <p className="text-sm font-bold text-forest">{t("saved")}</p>}
      {state && !state.ok && <p role="alert" className="text-sm font-bold text-red-700">{t(`error.${state.error}` as never)}</p>}
    </form>
  );
}
