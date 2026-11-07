"use client";

import { useSubmitKeepingValues } from "@/lib/useSubmitKeepingValues";

import { useActionState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  signUpClient,
  type SignupResult,
} from "@/app/[locale]/(site)/signup/actions";
import CountryField from "@/components/CountryField";
import { ArrowRightIcon, CheckCircleIcon, LockIcon } from "@/components/icons";

const inputCls =
  "w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink focus:border-forest focus:outline-none";
const labelCls = "mb-1.5 block text-sm font-semibold text-ink";

/** Client "Create account" form. Staff accounts are invite-only. */
export default function SignupForm() {
  const t = useTranslations("auth.signup");
  const tb = useTranslations("bookPage");
  const locale = useLocale();
  const [state, formAction, pending] = useActionState<SignupResult | null, FormData>(
    signUpClient,
    null
  );
  const submitKeepingValues = useSubmitKeepingValues(formAction);

  if (state?.status === "ok") {
    return (
      <div className="card flex flex-col items-center gap-4 p-8 text-center">
        <CheckCircleIcon width={48} height={48} className="text-forest" />
        <h1 className="text-xl font-bold text-forest">{t("checkEmailTitle")}</h1>
        <p className="text-sm text-muted">{t("checkEmailText")}</p>
        <Link href="/login" className="btn btn-outline-green mt-2 text-sm">
          {t("backToLogin")}
        </Link>
      </div>
    );
  }

  const error =
    state?.status === "invalid"
      ? state.field === "email"
        ? t("errorEmail")
        : state.field === "whatsapp"
          ? t("errorWhatsapp")
          : state.field === "password"
            ? t("errorPassword")
            : state.field === "country_other"
              ? tb("errorCountry")
              : state.field === "confirm_password"
              ? t("errorMismatch")
              : state.field === "terms"
                ? t("errorTerms")
                : t("errorRequired")
      : state?.status === "rate"
        ? t("errorRate")
        : state?.status === "error"
          ? t("errorGeneric")
          : null;

  return (
    <form onSubmit={submitKeepingValues} className="card p-6 md:p-8">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-forest text-white">
          <LockIcon width={22} height={22} />
        </span>
        <div>
          <h1 className="text-xl font-bold text-forest">{t("title")}</h1>
          <p className="text-xs text-muted">{t("subtitle")}</p>
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
          {error}
        </p>
      )}

      <input type="hidden" name="locale" value={locale} />
      <div aria-hidden className="hidden">
        <input name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="space-y-4">
        <label className="block">
          <span className={labelCls}>{t("name")} *</span>
          <input name="full_name" required minLength={2} maxLength={120} autoComplete="name" className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>{t("email")} *</span>
          <input name="email" type="email" required maxLength={254} autoComplete="email" className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>{t("whatsapp")} *</span>
          <input
            name="whatsapp"
            type="tel"
            required
            autoComplete="tel"
            placeholder={tb("whatsappHint")}
            className={inputCls}
          />
        </label>
        <CountryField label={t("country")} inputCls={inputCls} labelCls={labelCls} />
        <label className="block">
          <span className={labelCls}>{t("password")} *</span>
          <input
            name="password"
            type="password"
            required
            minLength={10}
            maxLength={72}
            autoComplete="new-password"
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className={labelCls}>{t("confirmPassword")} *</span>
          <input
            name="confirm_password"
            type="password"
            required
            minLength={10}
            maxLength={72}
            autoComplete="new-password"
            className={inputCls}
          />
        </label>
        <label className="flex items-start gap-2.5 text-sm text-ink">
          <input type="checkbox" name="terms" required className="mt-0.5 h-5 w-5 rounded accent-[#163a2b]" />
          <span>
            {t.rich("terms", {
              terms: (c) => (
                <Link href="/terms" className="font-semibold text-forest underline underline-offset-2">
                  {c}
                </Link>
              ),
              privacy: (c) => (
                <Link href="/privacy" className="font-semibold text-forest underline underline-offset-2">
                  {c}
                </Link>
              ),
            })}
          </span>
        </label>
      </div>

      <button type="submit" disabled={pending} className="btn btn-primary mt-6 w-full disabled:opacity-60">
        {t("submit")}
        <ArrowRightIcon width={18} height={18} />
      </button>
      <p className="mt-4 text-center text-xs text-muted">{t("verifyNote")}</p>
      <p className="mt-4 border-t border-line pt-4 text-center text-sm text-muted">
        {t("haveAccount")}{" "}
        <Link href="/login" className="font-semibold text-forest underline underline-offset-2">
          {t("logIn")}
        </Link>
      </p>
    </form>
  );
}
