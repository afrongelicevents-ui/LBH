"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { chooseInteriorItemAction } from "@/app/[locale]/account/(customer)/actions";

/** Choose / decline one option LBH proposed (only until LBH buys it). */
export default function InteriorChoice({ id, status }: { id: string; status: "option" | "chosen" | "declined" }) {
  const t = useTranslations("account.interiors");
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState<string | null>(null);
  const act = (choose: boolean) =>
    start(async () => {
      setFailed(null);
      try {
        const r = await chooseInteriorItemAction(id, choose);
        if (!r.ok) setFailed(r.error);
      } catch {
        setFailed("error");
      }
    });
  return (
    <div className="flex flex-wrap items-center gap-2">
      {status !== "chosen" && (
        <button type="button" disabled={pending} onClick={() => act(true)} className="ds-btn ds-btn-primary min-h-9 px-4 py-1.5 text-sm disabled:opacity-60" data-testid="interior-choose">
          {t("choose")}
        </button>
      )}
      {status !== "declined" && (
        <button type="button" disabled={pending} onClick={() => act(false)} className="ds-btn ds-btn-outline min-h-9 px-4 py-1.5 text-sm disabled:opacity-60" data-testid="interior-decline">
          {status === "chosen" ? t("undo") : t("decline")}
        </button>
      )}
      {failed && (
        <span role="alert" className="text-xs font-semibold text-[#a0461a]">
          {failed === "bought" ? t("alreadyBought") : t("failed")}
        </span>
      )}
    </div>
  );
}
