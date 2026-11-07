"use client";

import { guardAction, useSubmitKeepingValues } from "@/lib/useSubmitKeepingValues";

import { useState, useActionState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  createMaterialsRequest,
  type ActionResult,
} from "@/app/[locale]/portal/actions";
import { useDirectUpload } from "@/lib/useDirectUpload";
import { ArrowRightIcon, CloseIcon } from "@/components/icons";

const inputCls =
  "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink focus:border-forest focus:outline-none";
const labelCls = "mb-1.5 block text-sm font-semibold text-ink";

interface Item {
  item: string;
  quantity: string;
  notes: string;
}

export default function MaterialsRequestForm() {
  const t = useTranslations("portal.forms");
  const locale = useLocale();
  const router = useRouter();
  const { upload, progress } = useDirectUpload();
  const [items, setItems] = useState<Item[]>([{ item: "", quantity: "", notes: "" }]);

  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    guardAction<ActionResult>(async (prev, fd) => {
      fd.set(
        "items_json",
        JSON.stringify(items.filter((i) => i.item.trim() && i.quantity.trim()))
      );
      const files = fd.getAll("documents").filter((f): f is File => f instanceof File && f.size > 0);
      fd.delete("documents");
      const up = await upload("client-document", files);
      if (!up.ok) return { ok: false as const, error: up.error === "size" ? "toobig" : up.error === "type" ? "filetype" : "error" };
      fd.set("uploads_json", JSON.stringify(up.refs));
      const res = await createMaterialsRequest(prev, fd);
      if (res.ok && res.id) {
        router.push(`/portal/requests/${res.id}${res.warning ? "?docs=failed" : ""}`, { locale });
      }
      return res;
    }, { ok: false, error: "network" }),
    null
  );
  const submitKeepingValues = useSubmitKeepingValues(formAction);

  function setItem(i: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  return (
    <form onSubmit={submitKeepingValues} className="card space-y-5 p-6 md:p-8">
      {state && !state.ok && (
        <p role="alert" className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
          {t(`error.${state.error}` as never)}
        </p>
      )}

      <label className="block">
        <span className={labelCls}>{t("siteAddress")} *</span>
        <input name="site_address" required maxLength={300} className={inputCls} />
      </label>

      <div>
        <span className={labelCls}>{t("itemList")} *</span>
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={i} className="flex items-start gap-2 rounded-xl border border-line p-2 sm:border-0 sm:p-0">
              <div className="grid min-w-0 flex-1 grid-cols-3 gap-2 sm:grid-cols-4">
                <input
                  value={it.item}
                  onChange={(e) => setItem(i, { item: e.target.value })}
                  placeholder={t("itemName")}
                  aria-label={t("itemName")}
                  className={`${inputCls} col-span-2 min-w-0`}
                  maxLength={200}
                />
                <input
                  value={it.quantity}
                  onChange={(e) => setItem(i, { quantity: e.target.value })}
                  placeholder={t("itemQty")}
                  aria-label={t("itemQty")}
                  className={`${inputCls} min-w-0`}
                  maxLength={60}
                />
                <input
                  value={it.notes}
                  onChange={(e) => setItem(i, { notes: e.target.value })}
                  placeholder={t("itemNotes")}
                  aria-label={t("itemNotes")}
                  className={`${inputCls} col-span-3 min-w-0 sm:col-span-1`}
                  maxLength={300}
                />
              </div>
              {items.length > 1 && (
                <button
                  type="button"
                  aria-label={t("removeItem")}
                  onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted hover:text-red-700"
                >
                  <CloseIcon width={16} height={16} />
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setItems((prev) => [...prev, { item: "", quantity: "", notes: "" }])}
          className="mt-2 text-sm font-semibold text-forest underline underline-offset-2"
        >
          + {t("addItem")}
        </button>
      </div>

      <label className="block">
        <span className={labelCls}>{t("boqUpload")}</span>
        <input
          type="file"
          name="documents"
          multiple
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="block w-full text-sm text-muted file:mr-3 file:rounded-full file:border-0 file:bg-forest file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
        />
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className={labelCls}>{t("neededBy")}</span>
          <input type="date" name="needed_by" className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>{t("deliveryInstructions")}</span>
          <input name="delivery_instructions" maxLength={2000} className={inputCls} />
        </label>
      </div>

      <button type="submit" disabled={pending} className="btn btn-primary w-full disabled:opacity-60 sm:w-auto">
        {t("submitMaterials")}
        <ArrowRightIcon width={18} height={18} />
      </button>
      {pending && progress && progress.total > 0 && (
        <p className="text-xs text-muted" aria-live="polite">
          {t("uploadingFiles", { done: progress.done, total: progress.total })}
        </p>
      )}
    </form>
  );
}
