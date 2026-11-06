"use client";

import { useActionState } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  submitNotifyInterest,
  type NotifyResult,
} from "@/app/actions/notify";
import { CheckCircleIcon } from "./icons";

/** "Notify me" capture for coming-soon services (saves to admin interest list). */
export default function NotifyMeForm({ service }: { service: "monitoring" | "camera" }) {
  const t = useTranslations("notify");
  const locale = useLocale();
  const [state, formAction, pending] = useActionState<NotifyResult | null, FormData>(
    submitNotifyInterest,
    null
  );

  if (state === "ok") {
    return (
      <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-forest">
        <CheckCircleIcon width={18} height={18} className="text-gold" />
        {t("saved")}
      </p>
    );
  }

  return (
    <form action={formAction} className="mt-4 flex flex-col gap-2 sm:flex-row">
      <input type="hidden" name="service" value={service} />
      <input type="hidden" name="locale" value={locale} />
      <div aria-hidden className="hidden">
        <input name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <input
        type="email"
        name="email"
        required
        placeholder={t("emailPlaceholder")}
        className="w-full flex-1 rounded-full border border-line bg-white px-4 py-2.5 text-sm text-ink focus:border-forest focus:outline-none"
        aria-label={t("emailPlaceholder")}
      />
      <button
        type="submit"
        disabled={pending}
        className="btn btn-green min-h-10 px-5 text-sm disabled:opacity-60"
      >
        {t("button")}
      </button>
      {(state === "invalid" || state === "error" || state === "rate") && (
        <p role="alert" className="text-xs font-semibold text-red-700 sm:self-center">
          {t("error")}
        </p>
      )}
    </form>
  );
}
