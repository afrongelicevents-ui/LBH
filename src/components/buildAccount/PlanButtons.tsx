"use client";

import { useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { startSubscription, simulateBaPayment, acceptInvite } from "@/app/[locale]/portal/build-account/actions";

const isNav = (e: unknown) => !!e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_");

export function SubscribeButton({ plan, label }: { plan: "monthly" | "yearly"; label: string }) {
  const t = useTranslations("ba");
  const locale = useLocale();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <span className="block">
      <button
        type="button"
        disabled={pending}
        data-testid={`subscribe-${plan}`}
        onClick={() =>
          start(async () => {
            setErr(null);
            try {
              const r = await startSubscription(plan, locale);
              if (r && !r.ok) setErr(r.error);
            } catch (e) {
              if (isNav(e)) throw e;
              setErr("network");
            }
          })
        }
        className="btn btn-green w-full disabled:opacity-60"
      >
        {label}
      </button>
      {err && <span role="alert" className="mt-1 block text-xs font-bold text-red-700">{t(`error.${err}` as never)}</span>}
    </span>
  );
}

export function SimulateBaButtons({ reference }: { reference: string }) {
  const t = useTranslations("pay");
  const locale = useLocale();
  const [pending, start] = useTransition();
  const run = (o: "paid" | "failed") =>
    start(async () => {
      try {
        await simulateBaPayment(reference, o, locale);
      } catch (e) {
        if (isNav(e)) throw e;
      }
    });
  return (
    <div className="mt-5 flex flex-col gap-3">
      <button type="button" disabled={pending} onClick={() => run("paid")} className="btn btn-primary disabled:opacity-60">
        {t("simulatePaid")}
      </button>
      <button type="button" disabled={pending} onClick={() => run("failed")} className="btn btn-outline-green disabled:opacity-60">
        {t("simulateFailed")}
      </button>
    </div>
  );
}

export function AcceptInviteButton({ token }: { token: string }) {
  const t = useTranslations("ba");
  const locale = useLocale();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <span className="block">
      <button
        type="button"
        disabled={pending}
        data-testid="ba-accept"
        onClick={() =>
          start(async () => {
            setErr(null);
            try {
              const r = await acceptInvite(token, locale);
              if (r && !r.ok) setErr(r.error);
            } catch (e) {
              if (isNav(e)) throw e;
              setErr("network");
            }
          })
        }
        className="btn btn-green w-full disabled:opacity-60"
      >
        {t("join.accept")}
      </button>
      {err && <span role="alert" className="mt-2 block text-sm font-bold text-red-700">{t(`error.${err}` as never)}</span>}
    </span>
  );
}
