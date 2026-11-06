"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { ShieldCheckIcon } from "@/components/icons";

const inputCls =
  "w-full rounded-xl border border-line bg-white px-4 py-3 text-center text-lg tracking-[0.3em] text-ink focus:border-forest focus:outline-none";

/**
 * 2FA for staff (brief §11): enroll a TOTP factor on first login,
 * then challenge on every later login until AAL2 is reached.
 */
export default function MfaSetup() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const supabase = createClient();

  const [mode, setMode] = useState<"loading" | "enroll" | "challenge">("loading");
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const init = useCallback(async () => {
    // All state updates below happen after awaits (never synchronously in the effect)
    await Promise.resolve();
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const verified = factors?.totp?.find((f) => f.status === "verified");
    if (verified) {
      setFactorId(verified.id);
      setMode("challenge");
      return;
    }
    // Clean up abandoned unverified factors, then enroll fresh.
    for (const f of factors?.all ?? []) {
      if (f.status === "unverified") {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
    }
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Authenticator app",
    });
    if (error || !data) {
      setError(t("errorGeneric"));
      return;
    }
    setFactorId(data.id);
    setQr(data.totp.qr_code);
    setSecret(data.totp.secret);
    setMode("enroll");
  }, [supabase, t]);

  useEffect(() => {
    const initial = setTimeout(() => void init(), 0);
    return () => clearTimeout(initial);
  }, [init]);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setBusy(true);
    setError(null);
    const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({
      factorId,
    });
    if (chErr || !challenge) {
      setBusy(false);
      setError(t("errorGeneric"));
      return;
    }
    const { error: vErr } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: code.trim(),
    });
    setBusy(false);
    if (vErr) {
      setError(t("mfaWrongCode"));
      return;
    }
    window.location.assign(`/${locale}/login`);
  }

  return (
    <div className="card p-6 md:p-8">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-forest text-gold">
          <ShieldCheckIcon width={22} height={22} />
        </span>
        <div>
          <h1 className="text-xl font-bold text-forest">{t("mfaTitle")}</h1>
          <p className="text-xs text-muted">{t("mfaRequired")}</p>
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
          {error}
        </p>
      )}

      {mode === "loading" && <p className="text-sm text-muted">…</p>}

      {mode === "enroll" && (
        <>
          <p className="text-sm text-muted">{t("mfaScan")}</p>
          {qr && (
            // Supabase returns the QR as an SVG data URI
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="TOTP QR code" className="mx-auto mt-4 h-44 w-44" />
          )}
          {secret && (
            <p className="mt-2 text-center text-xs break-all text-muted">
              {t("mfaSecret")}: <code>{secret}</code>
            </p>
          )}
        </>
      )}

      {mode === "challenge" && <p className="text-sm text-muted">{t("mfaEnterCode")}</p>}

      {mode !== "loading" && (
        <form onSubmit={verify} className="mt-5">
          <input
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="000000"
            className={inputCls}
            aria-label={t("mfaEnterCode")}
          />
          <button type="submit" disabled={busy || code.length < 6} className="btn btn-gold mt-4 w-full disabled:opacity-60">
            {t("mfaVerify")}
          </button>
        </form>
      )}
    </div>
  );
}
