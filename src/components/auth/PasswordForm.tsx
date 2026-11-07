"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { LockIcon } from "@/components/icons";

const inputCls =
  "w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink focus:border-forest focus:outline-none";

/** Set a new password after an invite / recovery link. */
export default function PasswordForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Invite / reset links arrive with the session in the URL fragment:
  // store it (then remove it from the address bar) so the password can be set.
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const access_token = hash.get("access_token");
    const refresh_token = hash.get("refresh_token");
    const linkError = hash.get("error_description");
    if (window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    if (linkError) {
      setTimeout(() => setError(t("linkExpired")), 0);
      return;
    }
    if (access_token && refresh_token) {
      createClient()
        .auth.setSession({ access_token, refresh_token })
        .then(({ error }) => error && setError(t("linkExpired")))
        .catch(() => setError(t("errorNetwork")));
    }
  }, [t]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 10) {
      setError(t("passwordTooShort"));
      return;
    }
    if (password !== confirm) {
      setError(t("passwordMismatch"));
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = createClient();
    let failed: { message?: string; status?: number } | null = null;
    try {
      const { error } = await supabase.auth.updateUser({ password });
      failed = error;
    } catch {
      failed = { status: 0 };
    }
    setBusy(false);
    if (failed) {
      setError(
        failed.status === 0
          ? t("errorNetwork")
          : /session/i.test(failed.message ?? "")
            ? t("linkExpired")
            : t("errorGeneric")
      );
      return;
    }
    // Signed in now → straight to their portal (the login page routes by role)
    window.location.assign(`/${locale}/login`);
  }

  return (
    <form onSubmit={submit} className="card p-6 md:p-8">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-forest text-white">
          <LockIcon width={22} height={22} />
        </span>
        <h1 className="text-xl font-bold text-forest">{t("setPasswordTitle")}</h1>
      </div>
      {error && (
        <p role="alert" className="mb-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
          {error}
        </p>
      )}
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-ink">{t("newPassword")}</span>
        <input
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputCls}
        />
      </label>
      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm font-semibold text-ink">{t("confirmPassword")}</span>
        <input
          type="password"
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={inputCls}
        />
      </label>
      <button type="submit" disabled={busy} className="btn btn-primary mt-6 w-full disabled:opacity-60">
        {t("savePassword")}
      </button>
    </form>
  );
}
