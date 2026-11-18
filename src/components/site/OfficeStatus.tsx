"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { getOfficeStatus } from "@/app/actions/visitorChat";

export type Status = { online: boolean; replyHours: number; whatsapp: boolean };

/** Office status, read once in the browser so cached pages still show the live state. */
export function useOfficeStatus(enabled = true): Status | null {
  const [s, setS] = useState<Status | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    getOfficeStatus()
      .then((r) => alive && setS(r))
      .catch(() => alive && setS({ online: false, replyHours: 24, whatsapp: false }));
    return () => {
      alive = false;
    };
  }, [enabled]);
  return s;
}

/** "● Online now" (green) or "We'll reply within 24 hours". */
export function StatusPill({ s, className = "" }: { s: Status | null; className?: string }) {
  const t = useTranslations("site.chat");
  if (!s) return <span className={`inline-block h-5 ${className}`} aria-hidden />;
  return s.online ? (
    <span className={`inline-flex items-center gap-1.5 text-sm font-semibold text-forest ${className}`} data-testid="status-online">
      <span aria-hidden className="h-2 w-2 rounded-full bg-[#2f9e5b]" />
      {t("online")}
    </span>
  ) : (
    <span className={`text-sm text-slate ${className}`} data-testid="status-offline">
      {t("replyWithin", { hours: s.replyHours })}
    </span>
  );
}

/** The promise shown on the booking and contact pages. */
export default function ReplyPromise() {
  const t = useTranslations("site.chat");
  const s = useOfficeStatus();
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 border-l-2 border-forest bg-paper px-4 py-3 text-[15px] text-charcoal" data-testid="reply-promise">
      <span>{t("promise", { hours: s?.replyHours ?? 24 })}</span>
      {s?.online && <StatusPill s={s} />}
    </p>
  );
}
