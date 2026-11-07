"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { LockIcon, ArrowRightIcon } from "@/components/icons";

const inputCls =
  "w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink focus:border-forest focus:outline-none";

export default function LoginForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setError(t("errorInvalid"));
      return;
    }
    // Full reload so the server picks up the session, then routes by role.
    window.location.assign(`/${locale}/login`);
  }

  async function resetPassword() {
    if (!email) {
      setError(t("errorEnterEmail"));
      return;
    }
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/${locale}/account/password`,
    });
    setBusy(false);
    if (error) setError(t("errorGeneric"));
    else setNotice(t("resetSent"));
  }

  return (
    <form onSubmit={signIn} className="card p-6 md:p-8">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-forest text-white">
          <LockIcon width={22} height={22} />
        </span>
        <div>
          <h1 className="text-xl font-bold text-forest">{t("loginTitle")}</h1>
          <p className="text-xs text-muted">{t("loginSubtitle")}</p>
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
          {error}
        </p>
      )}
      {notice && (
        <p className="mb-4 rounded-xl bg-info px-4 py-3 text-sm font-semibold text-ink">
          {notice}
        </p>
      )}

      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-ink">{t("email")}</span>
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
        <span className="mb-1.5 block text-sm font-semibold text-ink">{t("password")}</span>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputCls}
        />
      </label>

      <button type="submit" disabled={busy} className="btn btn-primary mt-6 w-full disabled:opacity-60">
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
      <p className="mt-5 border-t border-line pt-4 text-center text-xs text-muted">
        {t("noAccountHint")}
      </p>
    </form>
  );
}
