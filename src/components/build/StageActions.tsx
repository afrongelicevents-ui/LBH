"use client";

import { useState, useTransition, useActionState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useDirectUpload } from "@/lib/useDirectUpload";
import {
  approveStageQuoteAction,
  approveStageAction,
  addStagePhotos,
  recordPurchase,
  advanceStage,
  submitInspection,
  addStageQuote,
  updateStage,
  addStage,
  deleteStage,
  moveStage,
  createBuild,
  type StageResult,
} from "@/app/actions/stages";

const inputCls =
  "w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink focus:border-forest focus:outline-none";
const labelCls = "mb-1 block text-xs font-semibold text-ink";
const fileCls =
  "block w-full text-xs text-muted file:mr-3 file:rounded-full file:border-0 file:bg-forest file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white";

function Msg({ state }: { state: StageResult | null }) {
  const t = useTranslations("build");
  if (!state) return null;
  return state.ok ? (
    <p className="text-xs font-bold text-forest">{t("saved")}</p>
  ) : (
    <p role="alert" className="text-xs font-bold text-red-700">
      {t(`error.${state.error}` as never)}
    </p>
  );
}

function useAct() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<StageResult | null>(null);
  return {
    pending,
    result,
    run: (fn: () => Promise<StageResult>) => start(async () => setResult(await fn())),
  };
}

/** Upload chosen files directly to storage, then call the action with refs. */
function useUploadingAction(
  action: (prev: StageResult | null, fd: FormData) => Promise<StageResult>,
  fileField = "photos"
) {
  const { upload, progress } = useDirectUpload();
  const [state, formAction, pending] = useActionState<StageResult | null, FormData>(
    async (prev, fd) => {
      const files = fd.getAll(fileField).filter((f): f is File => f instanceof File && f.size > 0);
      fd.delete(fileField);
      const up = await upload("staff-media", files);
      if (!up.ok) {
        return { ok: false, error: up.error === "size" ? "toobig" : up.error === "type" ? "filetype" : "upload" };
      }
      fd.set("uploads_json", JSON.stringify(up.refs));
      return action(prev, fd);
    },
    null
  );
  return { state, formAction, pending, progress };
}

// ======================== client ========================

export function ApproveQuoteButton({ quoteId, supplier }: { quoteId: string; supplier: string }) {
  const t = useTranslations("build");
  const [confirming, setConfirming] = useState(false);
  const { pending, result, run } = useAct();
  if (result?.ok) return <p className="text-xs font-bold text-forest">{t("saved")}</p>;
  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="btn btn-gold min-h-10 px-4 text-sm">
        {t("chooseSupplier")}
      </button>
    );
  }
  return (
    <div className="w-full rounded-xl bg-info p-3 text-sm text-ink">
      <p>{t("chooseSupplierConfirm", { supplier })}</p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => approveStageQuoteAction(quoteId))}
          className="btn btn-gold min-h-10 px-4 text-sm disabled:opacity-60"
        >
          {t("yesChoose")}
        </button>
        <button type="button" onClick={() => setConfirming(false)} className="btn btn-outline-green min-h-10 px-4 text-sm">
          {t("cancel")}
        </button>
      </div>
      <Msg state={result} />
    </div>
  );
}

export function ApproveStageButton({ stageId, stageName }: { stageId: string; stageName: string }) {
  const t = useTranslations("build");
  const [confirming, setConfirming] = useState(false);
  const { pending, result, run } = useAct();
  if (result?.ok) return <p className="text-sm font-bold text-forest">{t("stageApprovedMsg")}</p>;
  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="btn btn-gold min-h-11 w-full sm:w-auto">
        {t("approveStage")}
      </button>
    );
  }
  return (
    <div className="rounded-xl bg-info p-3 text-sm text-ink">
      <p>{t("approveStageConfirm", { stage: stageName })}</p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => approveStageAction(stageId))}
          className="btn btn-gold min-h-10 px-4 text-sm disabled:opacity-60"
        >
          {t("yesApprove")}
        </button>
        <button type="button" onClick={() => setConfirming(false)} className="btn btn-outline-green min-h-10 px-4 text-sm">
          {t("cancel")}
        </button>
      </div>
      <Msg state={result} />
    </div>
  );
}

// ======================== staff ========================

export function StagePhotoForm({
  stageId,
  kind,
}: {
  stageId: string;
  kind: "delivery" | "progress" | "inspection";
}) {
  const t = useTranslations("build");
  const { state, formAction, pending, progress } = useUploadingAction((prev, fd) =>
    addStagePhotos(stageId, kind, prev, fd)
  );
  return (
    <form action={formAction} className="space-y-2">
      <input type="file" name="photos" multiple required accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime" className={fileCls} />
      <input name="note" maxLength={1000} placeholder={t("photoNote")} className={inputCls} />
      <button type="submit" disabled={pending} className="btn btn-outline-green min-h-10 px-4 text-sm disabled:opacity-60">
        {pending && progress ? t("uploading", { done: progress.done, total: progress.total }) : t(`addPhotos.${kind}` as never)}
      </button>
      <Msg state={state} />
    </form>
  );
}

export function PurchaseForm({ stageId }: { stageId: string }) {
  const t = useTranslations("build");
  const { state, formAction, pending, progress } = useUploadingAction(
    (prev, fd) => recordPurchase(stageId, prev, fd),
    "receipt"
  );
  return (
    <form action={formAction} className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <label>
          <span className={labelCls}>{t("supplier")} *</span>
          <input name="supplier_name" required maxLength={200} className={inputCls} />
        </label>
        <label>
          <span className={labelCls}>{t("amountPaid")} *</span>
          <input name="amount" required inputMode="decimal" placeholder="0.00" className={inputCls} />
        </label>
      </div>
      <label className="block">
        <span className={labelCls}>{t("receiptPhoto")} *</span>
        <input type="file" name="receipt" required accept="image/jpeg,image/png,image/webp" className={fileCls} />
      </label>
      <input name="note" maxLength={1000} placeholder={t("photoNote")} className={inputCls} />
      <button type="submit" disabled={pending} className="btn btn-gold min-h-10 px-4 text-sm disabled:opacity-60">
        {pending && progress ? t("uploading", { done: progress.done, total: progress.total }) : t("recordPurchase")}
      </button>
      <Msg state={state} />
    </form>
  );
}

export function AdvanceButton({ stageId, to }: { stageId: string; to: "delivered" | "building" }) {
  const t = useTranslations("build");
  const { pending, result, run } = useAct();
  if (result?.ok) return <Msg state={result} />;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => advanceStage(stageId, to))}
        className="btn btn-gold min-h-10 px-4 text-sm disabled:opacity-60"
      >
        {t(`advance.${to}` as never)}
      </button>
      <Msg state={result} />
    </span>
  );
}

export function InspectionForm({ stageId, defaultMaterials }: { stageId: string; defaultMaterials: string }) {
  const t = useTranslations("build");
  const { state, formAction, pending, progress } = useUploadingAction((prev, fd) =>
    submitInspection(stageId, prev, fd)
  );
  return (
    <form action={formAction} className="space-y-2">
      <label className="block">
        <span className={labelCls}>{t("inspectionPhotos")} *</span>
        <input type="file" name="photos" multiple required accept="image/jpeg,image/png,image/webp" className={fileCls} />
      </label>
      <label className="block">
        <span className={labelCls}>{t("materialsUsed")} *</span>
        <textarea name="materials" required rows={4} defaultValue={defaultMaterials} className={inputCls} />
        <span className="mt-1 block text-[11px] text-muted">{t("materialsHint")}</span>
      </label>
      <label className="block">
        <span className={labelCls}>{t("inspectionNotes")} *</span>
        <textarea name="notes" required rows={3} maxLength={4000} className={inputCls} />
      </label>
      <button type="submit" disabled={pending} className="btn btn-gold min-h-10 px-4 text-sm disabled:opacity-60">
        {pending && progress ? t("uploading", { done: progress.done, total: progress.total }) : t("submitInspection")}
      </button>
      <Msg state={state} />
    </form>
  );
}

// ======================== admin ========================

export function AddQuoteForm({ stageId }: { stageId: string }) {
  const t = useTranslations("build");
  const [state, formAction, pending] = useActionState<StageResult | null, FormData>(
    (prev, fd) => addStageQuote(stageId, prev, fd),
    null
  );
  return (
    <form action={formAction} className="space-y-2 rounded-xl border border-line p-3">
      <p className="text-xs font-bold text-forest">{t("addQuote")}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <input name="supplier_name" required maxLength={200} placeholder={t("supplier")} className={inputCls} />
        <input name="amount" required inputMode="decimal" placeholder={t("amountUsd")} className={inputCls} />
      </div>
      <textarea name="items" rows={3} maxLength={4000} placeholder={t("quoteItems")} className={inputCls} />
      <button type="submit" disabled={pending} className="btn btn-outline-green min-h-10 px-4 text-sm disabled:opacity-60">
        {t("addQuoteButton")}
      </button>
      <Msg state={state} />
    </form>
  );
}

export function StageEditor({
  stageId,
  name,
  description,
  canMove,
  canDelete,
}: {
  stageId: string;
  name: string;
  description: string;
  canMove: boolean;
  canDelete: boolean;
}) {
  const t = useTranslations("build");
  const [open, setOpen] = useState(false);
  const { pending, result, run } = useAct();
  const [state, formAction, saving] = useActionState<StageResult | null, FormData>(
    (prev, fd) => updateStage(stageId, prev, fd),
    null
  );
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button type="button" onClick={() => setOpen(!open)} className="rounded-full px-2.5 py-1 text-xs font-semibold text-forest underline">
        {t("edit")}
      </button>
      {canMove && (
        <>
          <button type="button" disabled={pending} onClick={() => run(() => moveStage(stageId, -1))} aria-label={t("moveUp")} className="h-8 w-8 rounded-full border border-line text-xs">↑</button>
          <button type="button" disabled={pending} onClick={() => run(() => moveStage(stageId, 1))} aria-label={t("moveDown")} className="h-8 w-8 rounded-full border border-line text-xs">↓</button>
        </>
      )}
      {canDelete && (
        <button type="button" disabled={pending} onClick={() => run(() => deleteStage(stageId))} className="rounded-full px-2.5 py-1 text-xs font-semibold text-red-700 underline">
          {t("remove")}
        </button>
      )}
      <Msg state={result && !result.ok ? result : null} />
      {open && (
        <form action={formAction} className="mt-2 w-full space-y-2">
          <input name="name" defaultValue={name} required maxLength={80} className={inputCls} />
          <textarea name="description" defaultValue={description} rows={2} maxLength={1000} className={inputCls} />
          <button type="submit" disabled={saving} className="btn btn-outline-green min-h-9 px-4 text-xs">{t("save")}</button>
          <Msg state={state} />
        </form>
      )}
    </div>
  );
}

export function AddStageForm({ requestId }: { requestId: string }) {
  const t = useTranslations("build");
  const [state, formAction, pending] = useActionState<StageResult | null, FormData>(
    (prev, fd) => addStage(requestId, prev, fd),
    null
  );
  return (
    <form action={formAction} className="card space-y-2 p-4">
      <p className="text-sm font-bold text-forest">{t("addStage")}</p>
      <input name="name" required maxLength={80} placeholder={t("stageName")} className={inputCls} />
      <textarea name="description" rows={2} maxLength={1000} placeholder={t("stageDescription")} className={inputCls} />
      <button type="submit" disabled={pending} className="btn btn-outline-green min-h-10 px-4 text-sm">{t("addStageButton")}</button>
      <Msg state={state} />
    </form>
  );
}

export function CreateBuildForm({
  clients,
  staff,
}: {
  clients: { id: string; label: string }[];
  staff: { id: string; label: string }[];
}) {
  const t = useTranslations("build");
  const router = useRouter();
  const [state, formAction, pending] = useActionState<StageResult | null, FormData>(
    async (prev, fd) => {
      const res = await createBuild(prev, fd);
      if (res.ok && res.id) router.push(`/admin/builds/${res.id}`);
      return res;
    },
    null
  );
  return (
    <form action={formAction} className="card space-y-3 p-5">
      <p className="text-sm font-bold text-forest">{t("newBuild")}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className={labelCls}>{t("client")} *</span>
          <select name="client_id" required defaultValue="" className={inputCls}>
            <option value="" disabled>—</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </label>
        <label>
          <span className={labelCls}>{t("fieldStaff")}</span>
          <select name="staff_id" defaultValue="" className={inputCls}>
            <option value="">—</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
        <label>
          <span className={labelCls}>{t("projectTitle")} *</span>
          <input name="title" required maxLength={150} className={inputCls} />
        </label>
        <label>
          <span className={labelCls}>{t("siteAddress")} *</span>
          <input name="site_address" required maxLength={300} className={inputCls} />
        </label>
      </div>
      <p className="text-[11px] text-muted">{t("newBuildHint")}</p>
      <button type="submit" disabled={pending} className="btn btn-gold min-h-10 px-5 text-sm disabled:opacity-60">{t("createBuild")}</button>
      <Msg state={state} />
    </form>
  );
}
