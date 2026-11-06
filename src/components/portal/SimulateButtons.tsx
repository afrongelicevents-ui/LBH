"use client";

import { useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { simulatePaymentOutcome } from "@/app/[locale]/(site)/pay/actions";

export default function SimulateButtons({ reference }: { reference: string }) {
  const t = useTranslations("pay");
  const locale = useLocale();
  const [pending, start] = useTransition();

  return (
    <div className="mt-5 flex flex-col gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => simulatePaymentOutcome(reference, "paid", locale))}
        className="btn btn-gold disabled:opacity-60"
      >
        {t("simulatePaid")}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => simulatePaymentOutcome(reference, "failed", locale))}
        className="btn btn-outline-green disabled:opacity-60"
      >
        {t("simulateFailed")}
      </button>
    </div>
  );
}
