"use client";

import { useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { simulatePaymentOutcome } from "@/app/[locale]/(site)/pay/actions";

export default function SimulateButtons({ reference }: { reference: string }) {
  const t = useTranslations("pay");
  const locale = useLocale();
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);
  const run = (outcome: "paid" | "failed") =>
    start(async () => {
      setFailed(false);
      try {
        await simulatePaymentOutcome(reference, outcome, locale);
      } catch (e) {
        if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_")) throw e;
        setFailed(true);
      }
    });

  return (
    <div className="mt-5 flex flex-col gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() => run("paid")}
        className="btn btn-primary disabled:opacity-60"
      >
        {t("simulatePaid")}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => run("failed")}
        className="btn btn-outline-green disabled:opacity-60"
      >
        {t("simulateFailed")}
      </button>
      {failed && (
        <p role="alert" className="text-sm font-semibold text-red-700">
          {t("simulateError")}
        </p>
      )}
    </div>
  );
}
