"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Link } from "@/i18n/navigation";
import { resendConfirmation, requestPasswordReset } from "@/app/[locale]/(site)/signup/actions";
import { LockIcon, ArrowRightIcon } from "@/components/icons";

const inputCls = "ws-input";

export default function LoginForm({
  confirmFailed = false,
  next = null,
}: {
  confirmFailed?: boolean;
  next?: string | null;
}) {
  const t = useTranslations("auth");
  const tw = useTranslations("site.ws");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(confirmFailed ? t("confirmFailed") : null);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setUnconfirmed(false);
    setBusy(true);
    const supabase = createClient();
    let error: { code?: string; status?: number; name?: string } | null = null;
    try {
      ({ error } = await supabase.auth.signInWithPassword({ email, password }));
    } catch {
      error = { status: 0 };
    }
    setBusy(false);
    if (error) {
      if (error.code === "email_not_confirmed") {
        setUnconfirmed(true);
        setError(t("errorUnconfirmed"));
      } else if (error.status === 0 || error.name === "AuthRetryableFetchError") {
        setError(t("errorNetwork"));
      } else if (error.status === 429 || /rate/.test(error.code ?? "")) {
        setError(t("errorRate"));
      } else {
        setError(t("errorInvalid"));
      }
      return;
    }
    // Full reload so the server picks up the session, then routes by role
    // (or back to the page they were trying to open).
    window.location.assign(`/${locale}/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  }

  async function resendConfirmationClick() {
    setError(null);
    setBusy(true);
    const res = await resendConfirmation(email, locale).catch(() => "error" as const);
    setBusy(false);
    setUnconfirmed(false);
    if (res !== "ok") setError(t("errorGeneric"));
    else setNotice(t("confirmResent"));
  }

  async function resetPassword() {
    if (!email) {
      setError(t("errorEnterEmail"));
      return;
    }
    setError(null);
    setBusy(true);
    const res = await requestPasswordReset(email, locale).catch(() => "error" as const);
    setBusy(false);
    if (res === "ok") setNotice(t("resetSent"));
    else setError(res === "rate" ? t("errorRate") : t("errorNetwork"));
  }


  return (
    <form onSubmit={signIn}>
      <div className="mb-6">
        <div>
          <h1 className="font-serif text-[2.25rem] leading-[0.95] font-extrabold tracking-[-0.035em] md:text-[2.75rem]">{tw("signinTitle")}</h1>
          <p className="ws-lede mt-3">{t("loginSubtitle")}</p>
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-[16px] border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
          {error}
          {unconfirmed && (
            <button
              type="button"
              onClick={resendConfirmationClick}
              disabled={busy}
              className="mt-2 block font-bold text-forest underline underline-offset-2"
            >
              {t("resendConfirmation")}
            </button>
          )}
        </p>
      )}
      {notice && (
        <p className="mb-4 rounded-[16px] bg-info px-4 py-3 text-sm font-semibold text-ink">
          {notice}
        </p>
      )}

      <label className="block">
        <span className="mb-2 block text-sm font-bold text-ink">{t("email")}</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputCls}
        />
      </label>
      <label className="mt-4 block">
        <span className="mb-2 block text-sm font-bold text-ink">{t("password")}</span>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputCls}
        />
      </label>

      <button type="submit" disabled={busy} className="ds-btn ds-btn-primary mt-6 w-full disabled:opacity-60">
        {t("signIn")}
        <ArrowRightIcon width={18} height={18} />
      </button>
      <button
        type="button"
        onClick={resetPassword}
        disabled={busy}
        className="mt-4 block w-full text-center text-sm font-semibold text-forest underline-offset-2 hover:underline"
      >
        {t("forgot")}
      </button>
      <div className="mt-7 text-center">
        <div className="ws-split mb-3"><span>{tw("newToLbh")}</span></div>
        <Link href="/signup" className="ds-btn ds-btn-outline w-full">
          {t("createAccount")}
        </Link>
        <p className="mt-3 text-xs text-muted">{t("staffInviteOnly")}</p>
      </div>
    </form>
  );
}
