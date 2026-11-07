"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

/** Friendly error screen instead of a blank page (e.g. connection dropped). */
export default function LocaleError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errorPage");
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-offwhite px-4 py-16">
      <div className="card max-w-md p-6 text-center md:p-8" role="alert">
        <h1 className="text-xl font-bold text-forest">{t("title")}</h1>
        <p className="mt-2 text-sm text-muted">{t("text")}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={reset} className="btn btn-green text-sm">
            {t("retry")}
          </button>
          <Link href="/" className="btn btn-outline-green text-sm">
            {t("home")}
          </Link>
        </div>
      </div>
    </div>
  );
}
