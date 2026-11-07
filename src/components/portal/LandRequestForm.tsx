"use client";

import { useActionState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import dynamic from "next/dynamic";
import {
  createLandRequest,
  type ActionResult,
} from "@/app/[locale]/portal/actions";
import { useDirectUpload } from "@/lib/useDirectUpload";
import { ArrowRightIcon } from "@/components/icons";

const MapPicker = dynamic(() => import("./MapPicker"), { ssr: false });

const inputCls =
  "w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink focus:border-forest focus:outline-none";
const labelCls = "mb-1.5 block text-sm font-semibold text-ink";

export default function LandRequestForm() {
  const t = useTranslations("portal.forms");
  const locale = useLocale();
  const router = useRouter();
  const { upload, progress } = useDirectUpload();

  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    async (prev, fd) => {
      const files = fd.getAll("documents").filter((f): f is File => f instanceof File && f.size > 0);
      fd.delete("documents");
      const up = await upload("client-document", files);
      if (!up.ok) return { ok: false as const, error: up.error === "size" ? "toobig" : up.error === "type" ? "filetype" : "error" };
      fd.set("uploads_json", JSON.stringify(up.refs));
      const res = await createLandRequest(prev, fd);
      if (res.ok && res.id) router.push(`/portal/requests/${res.id}`, { locale });
      return res;
    },
    null
  );

  return (
    <form action={formAction} className="card space-y-5 p-6 md:p-8">
      {state && !state.ok && (
        <p role="alert" className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
          {t(`error.${state.error}` as never)}
        </p>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className={labelCls}>{t("town")} *</span>
          <input name="town" required maxLength={120} className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>{t("standNumber")} *</span>
          <input name="stand_number" required maxLength={60} className={inputCls} />
        </label>
      </div>

      <div>
        <span className={labelCls}>{t("mapPin")}</span>
        <MapPicker />
      </div>

      <label className="block">
        <span className={labelCls}>{t("documents")}</span>
        <input
          type="file"
          name="documents"
          multiple
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="block w-full text-sm text-muted file:mr-3 file:rounded-full file:border-0 file:bg-forest file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
        />
        <span className="mt-1 block text-xs text-muted">{t("documentsHint")}</span>
      </label>

      <label className="block">
        <span className={labelCls}>{t("introducedBy")}</span>
        <input name="introduced_by" maxLength={500} className={inputCls} />
      </label>

      <label className="block">
        <span className={labelCls}>{t("toldAbout")}</span>
        <textarea name="told_about" rows={4} maxLength={2000} className={inputCls} />
      </label>

      <button type="submit" disabled={pending} className="btn btn-primary w-full disabled:opacity-60 sm:w-auto">
        {t("submitLand")}
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
