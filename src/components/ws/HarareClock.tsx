"use client";

import { useEffect, useState } from "react";

/**
 * Zimbabwe time, ticking. `template` may use {time} (14:32), {seconds}
 * (14:32:07) and {date} (23 Nov). Renders nothing until mounted (no
 * server/client mismatch).
 */
export function HarareClock({ template }: { template: string }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- start the clock after hydration
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const fmt = (o: Intl.DateTimeFormatOptions) => (now ? new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Harare", ...o }).format(now) : "--");
  const text = template
    .replace("{time}", fmt({ hour: "2-digit", minute: "2-digit" }))
    .replace("{seconds}", fmt({ hour: "2-digit", minute: "2-digit", second: "2-digit" }))
    .replace("{date}", fmt({ day: "numeric", month: "short" }));
  return <span className="num">{text}</span>;
}
