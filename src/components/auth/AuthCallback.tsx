"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { safeNextPath } from "@/lib/signup";

/**
 * Finishes email confirmation from Supabase's standard link: the session
 * arrives in the URL fragment (never sent to any server), is stored in the
 * auth cookies, then the client portal opens. Works on any device.
 */
export default function AuthCallback() {
  const t = useTranslations("auth");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const query = new URLSearchParams(window.location.search);
    const next = safeNextPath(query.get("next"));
    const access_token = hash.get("access_token");
    const refresh_token = hash.get("refresh_token");
    // Remove the tokens from the address bar / history straight away.
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    if (!access_token || !refresh_token) {
      setTimeout(() => setFailed(true), 0);
      return;
    }
    createClient()
      .auth.setSession({ access_token, refresh_token })
      .then(({ error }) => {
        if (error) setFailed(true);
        else {
          // only ever go to a page on this site
          const target = new URL(`${next}${next.includes("?") ? "&" : "?"}welcome=1`, window.location.origin);
          window.location.replace(target.origin === window.location.origin ? target.href : "/portal");
        }
      })
      .catch(() => setFailed(true));
  }, []);

  return (
    <div className="card p-6 text-center md:p-8" role="status">
      {failed ? (
        <>
          <h1 className="text-xl font-bold text-forest">{t("confirmFailedTitle")}</h1>
          <p className="mt-2 text-sm text-muted">{t("confirmFailed")}</p>
          <Link href="/login" className="btn btn-green mt-5">
            {t("signIn")}
          </Link>
        </>
      ) : (
        <p className="text-sm font-semibold text-forest">{t("confirming")}</p>
      )}
    </div>
  );
}
