"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { setBudget } from "@/app/[locale]/portal/build-account/actions";

export default function BudgetInput({ stage, cents }: { stage: string; cents: number | null }) {
  const t = useTranslations("ba");
  const [value, setValue] = useState(cents === null ? "" : (cents / 100).toFixed(2));
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          try {
            const r = await setBudget(stage, value);
            setMsg(r.ok ? t("saved") : t(`error.${r.error}` as never));
          } catch {
            setMsg(t("error.network"));
          }
        });
      }}
    >
      <label className="sr-only" htmlFor={`b-${stage}`}>{t("budgetFor", { stage })}</label>
      <span className="text-sm text-muted">$</span>
      <input id={`b-${stage}`} value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" placeholder="0.00" className="w-28 rounded-xl border border-line bg-white px-2 py-1.5 text-sm" data-testid={`budget-${stage}`} />
      <button type="submit" disabled={pending} className="text-xs font-bold text-forest underline">
        {t("save")}
      </button>
      {msg && <span className="text-xs text-muted" role="status">{msg}</span>}
    </form>
  );
}
