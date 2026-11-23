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

const inputCls = "ws-input";
const labelCls = "mb-2 block text-sm font-bold text-ink";

/** Client "Create account" form. Staff accounts are invite-only. */
export default function SignupForm() {
  const t = useTranslations("auth.signup");
  const tw = useTranslations("site.ws");
  const tb = useTranslations("bookPage");
  const locale = useLocale();
  const [state, formAction, pending] = useActionState<SignupResult | null, FormData>(
    signUpClient,
    null
  );
  const submitKeepingValues = useSubmitKeepingValues(formAction);

  if (state?.status === "ok") {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center" data-testid="check-email">
        <span className="ws-tick">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
        </span>
        <h1 className="text-[2.1rem] leading-tight font-extrabold tracking-[-0.03em]">{t("checkEmailTitle")}</h1>
        <p className="max-w-[36ch] text-slate">{t("checkEmailText")}</p>
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
      : state?.status === "exists"
        ? "exists"
        : state?.status === "rate"
        ? t("errorRate")
        : state?.status === "error"
          ? t("errorGeneric")
          : null;

  return (
    <form onSubmit={submitKeepingValues}>
      <div className="mb-6">
        <h1 className="font-serif text-[2.25rem] leading-[0.95] font-extrabold tracking-[-0.035em] md:text-[2.75rem]">{tw("signupTitle")}</h1>
        <p className="ws-lede mt-3">{tw("signupIntro")}</p>
      </div>

      {error === "exists" ? (
        <div role="alert" className="mb-4 rounded-[16px] border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-charcoal" data-testid="signup-exists">
          <p className="font-semibold">{t("errorExists")}</p>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            <Link href="/login" className="font-semibold text-forest underline underline-offset-2">{t("existsLogin")}</Link>
            <Link href="/login" className="font-semibold text-forest underline underline-offset-2">{t("existsReset")}</Link>
          </p>
        </div>
      ) : error ? (
        <p role="alert" className="mb-4 rounded-[16px] border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
          {error}
        </p>
      ) : null}

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
          <input type="checkbox" name="terms" required className="mt-0.5 h-[22px] w-[22px] shrink-0 rounded accent-forest" />
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

      <button type="submit" disabled={pending} className="ds-btn ds-btn-primary mt-6 w-full disabled:opacity-60">
        {t("submit")}
      </button>
      <p className="mt-3 text-center text-xs text-muted">{t("verifyNote")}</p>
      <div className="ws-split mt-7 mb-3"><span>{tw("haveAccount")}</span></div>
      <Link href="/login" className="ds-btn ds-btn-outline w-full">
        {t("logIn")}
      </Link>
    </form>
  );
}
