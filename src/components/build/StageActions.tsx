"use client";

import { useState, useTransition, useActionState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useDirectUpload } from "@/lib/useDirectUpload";
import CameraCapture, { type Captured } from "@/components/field/CameraCapture";
import { useOutbox } from "@/components/field/OutboxProvider";
import { QueuedNote } from "@/components/field/JobForms";
import type { OutboxAction, OutboxFile } from "@/lib/field/outbox";
import { DollarIcon, LayersIcon, PaperclipIcon, PlusIcon, SendIcon, TruckIcon } from "@/components/ui/PortalIcons";
import {
  approveStageQuoteAction,
  approveStageAction,
  addStagePhotos,
  recordPurchase,
  advanceStage,
  submitInspection,
  addStageQuote,
  attachQuoteFile,
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
  fileField = "photos",
  purpose: "staff-media" | "quote-file" = "staff-media"
) {
  const { upload, progress } = useDirectUpload();
  const [state, formAction, pending] = useActionState<StageResult | null, FormData>(
    async (prev, fd) => {
      const files = fd.getAll(fileField).filter((f): f is File => f instanceof File && f.size > 0);
      fd.delete(fileField);
      const up = await upload(purpose, files);
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
      <button type="button" onClick={() => setConfirming(true)} className="btn btn-primary min-h-10 px-4 text-sm">
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
          className="btn btn-primary min-h-10 px-4 text-sm disabled:opacity-60"
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
      <button type="button" onClick={() => setConfirming(true)} className="btn btn-primary min-h-11 w-full sm:w-auto">
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
          className="btn btn-primary min-h-10 px-4 text-sm disabled:opacity-60"
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

function toOutboxFile(c: Captured): OutboxFile {
  return {
    blob: c.blob,
    name: c.name,
    type: c.type,
    capturedAt: c.capturedAt,
    lat: c.lat,
    lng: c.lng,
    accuracy: c.accuracy,
    clientRef: c.clientRef,
  };
}

/**
 * Field staff (inside the field area): photos come only from the in-app
 * camera and every save goes to the phone first, so it works with no
 * signal. Admin keeps a normal file picker and sends directly.
 */
function useFieldCapture(action: OutboxAction, stageId: string, label: string, extra?: string) {
  const outbox = useOutbox();
  const [files, setFiles] = useState<Captured[]>([]);
  const [queued, setQueued] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(
    e: React.FormEvent<HTMLFormElement>,
    check?: (fd: FormData, files: Captured[]) => string | null
  ) {
    if (!outbox) return;
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const problem = check?.(fd, files) ?? null;
    if (problem) {
      setErr(problem);
      return;
    }
    const fields: Record<string, string> = {};
    for (const [k, v] of fd.entries()) if (typeof v === "string") fields[k] = v;
    setBusy(true);
    setErr(null);
    try {
      await outbox.enqueue({ action, target: stageId, extra, label, fields, files: files.map(toOutboxFile) });
      files.forEach((f) => URL.revokeObjectURL(f.previewUrl));
      setFiles([]);
      form.reset();
      setQueued(true);
    } finally {
      setBusy(false);
    }
  }

  return {
    field: Boolean(outbox),
    files,
    setFiles: (v: Captured[]) => {
      setFiles(v);
      setQueued(false);
    },
    queued,
    busy,
    err,
    onSubmit,
  };
}

export function StagePhotoForm({
  stageId,
  stageName,
  kind,
}: {
  stageId: string;
  stageName: string;
  kind: "delivery" | "progress" | "inspection";
}) {
  const t = useTranslations("build");
  const { state, formAction, pending, progress } = useUploadingAction((prev, fd) =>
    addStagePhotos(stageId, kind, prev, fd)
  );
  const fc = useFieldCapture("stage-photos", stageId, `${t(`addPhotos.${kind}` as never)} — ${stageName}`, kind);
  const needPhoto = t("error.needInspectionPhoto");

  if (fc.field) {
    return (
      <form onSubmit={(e) => fc.onSubmit(e, (_fd, f) => (f.length === 0 ? needPhoto : null))} className="space-y-2">
        <CameraCapture mode="photo" value={fc.files} onChange={fc.setFiles} />
        <input name="note" maxLength={1000} placeholder={t("photoNote")} className={inputCls} />
        <button type="submit" disabled={fc.busy || fc.files.length === 0} className="btn btn-outline-green min-h-10 px-4 text-sm disabled:opacity-60">
          {t(`addPhotos.${kind}` as never)}
          {fc.files.length > 1 ? ` (${fc.files.length})` : ""}
        </button>
        {fc.err && <p role="alert" className="text-xs font-bold text-red-700">{fc.err}</p>}
        <QueuedNote show={fc.queued} />
      </form>
    );
  }

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

export function PurchaseForm({ stageId, stageName }: { stageId: string; stageName: string }) {
  const t = useTranslations("build");
  const { state, formAction, pending, progress } = useUploadingAction(
    (prev, fd) => recordPurchase(stageId, prev, fd),
    "receipt"
  );
  const fc = useFieldCapture("stage-purchase", stageId, `${t("recordPurchase")} — ${stageName}`);
  const needReceipt = t("error.needReceipt");

  const fields = (
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
  );

  if (fc.field) {
    return (
      <form onSubmit={(e) => fc.onSubmit(e, (_fd, f) => (f.length === 0 ? needReceipt : null))} className="space-y-2">
        {fields}
        <div>
          <span className={labelCls}>{t("receiptPhoto")} *</span>
          <CameraCapture mode="photo" multiple={false} value={fc.files} onChange={fc.setFiles} />
        </div>
        <input name="note" maxLength={1000} placeholder={t("photoNote")} className={inputCls} />
        <button type="submit" disabled={fc.busy} className="btn btn-primary min-h-10 px-4 text-sm disabled:opacity-60">
          {t("recordPurchase")}
        </button>
        {fc.err && <p role="alert" className="text-xs font-bold text-red-700">{fc.err}</p>}
        <QueuedNote show={fc.queued} />
      </form>
    );
  }

  return (
    <form action={formAction} className="space-y-2">
      {fields}
      <label className="block">
        <span className={labelCls}>{t("receiptPhoto")} *</span>
        <input type="file" name="receipt" required accept="image/jpeg,image/png,image/webp" className={fileCls} />
      </label>
      <input name="note" maxLength={1000} placeholder={t("photoNote")} className={inputCls} />
      <button type="submit" disabled={pending} className="btn btn-primary min-h-10 px-4 text-sm disabled:opacity-60">
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
        className="btn btn-primary min-h-10 px-4 text-sm disabled:opacity-60"
      >
        {t(`advance.${to}` as never)}
      </button>
      <Msg state={result} />
    </span>
  );
}

export function InspectionForm({
  stageId,
  stageName,
  defaultMaterials,
}: {
  stageId: string;
  stageName: string;
  defaultMaterials: string;
}) {
  const t = useTranslations("build");
  const { state, formAction, pending, progress } = useUploadingAction((prev, fd) =>
    submitInspection(stageId, prev, fd)
  );
  const fc = useFieldCapture("stage-inspection", stageId, `${t("submitInspection")} — ${stageName}`);
  const needPhoto = t("error.needInspectionPhoto");

  const textFields = (
    <>
      <label className="block">
        <span className={labelCls}>{t("materialsUsed")} *</span>
        <textarea name="materials" required rows={4} defaultValue={defaultMaterials} className={inputCls} />
        <span className="mt-1 block text-[11px] text-muted">{t("materialsHint")}</span>
      </label>
      <label className="block">
        <span className={labelCls}>{t("inspectionNotes")} *</span>
        <textarea name="notes" required rows={3} maxLength={4000} className={inputCls} />
      </label>
    </>
  );

  if (fc.field) {
    return (
      <form onSubmit={(e) => fc.onSubmit(e, (_fd, f) => (f.length === 0 ? needPhoto : null))} className="space-y-2">
        <div>
          <span className={labelCls}>{t("inspectionPhotos")} *</span>
          <CameraCapture mode="photo" value={fc.files} onChange={fc.setFiles} />
        </div>
        {textFields}
        <button type="submit" disabled={fc.busy} className="btn btn-primary min-h-10 px-4 text-sm disabled:opacity-60">
          {t("submitInspection")}
        </button>
        {fc.err && <p role="alert" className="text-xs font-bold text-red-700">{fc.err}</p>}
        <QueuedNote show={fc.queued} />
      </form>
    );
  }

  return (
    <form action={formAction} className="space-y-2">
      <label className="block">
        <span className={labelCls}>{t("inspectionPhotos")} *</span>
        <input type="file" name="photos" multiple required accept="image/jpeg,image/png,image/webp" className={fileCls} />
      </label>
      {textFields}
      <button type="submit" disabled={pending} className="btn btn-primary min-h-10 px-4 text-sm disabled:opacity-60">
        {pending && progress ? t("uploading", { done: progress.done, total: progress.total }) : t("submitInspection")}
      </button>
      <Msg state={state} />
    </form>
  );
}

// ======================== admin ========================

const iconInputCls =
  "w-full rounded-full border border-[#dfe3e1] bg-white py-2.5 pr-4 pl-12 text-sm text-ink focus:border-forest focus:outline-none";

function IconField({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="relative block">
      <span className="pointer-events-none absolute top-1/2 left-1.5 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-offwhite text-forest">
        {icon}
      </span>
      {children}
    </label>
  );
}

/** Admin: add a supplier quote, optionally with the supplier's own quote (photo/PDF). */
export function AddQuoteForm({ stageId }: { stageId: string }) {
  const t = useTranslations("build");
  const { state, formAction, pending, progress } = useUploadingAction(
    (prev, fd) => addStageQuote(stageId, prev, fd),
    "quote_file",
    "quote-file"
  );
  return (
    <form action={formAction} className="space-y-2.5 rounded-2xl border border-[#e6e9e7] bg-portal p-3 sm:p-4">
      <p className="flex items-center gap-2 text-base font-extrabold text-ink">
        <span className="icon-round icon-forest h-8 w-8">
          <PlusIcon size={18} />
        </span>
        {t("addQuote")}
      </p>
      <IconField icon={<TruckIcon size={16} />}>
        <input name="supplier_name" required maxLength={200} placeholder={t("supplier")} aria-label={t("supplier")} className={iconInputCls} />
      </IconField>
      <IconField icon={<DollarIcon size={16} />}>
        <input name="amount" required inputMode="decimal" placeholder={t("amountUsd")} aria-label={t("amountUsd")} className={iconInputCls} />
      </IconField>
      <IconField icon={<LayersIcon size={16} />}>
        <textarea
          name="items"
          rows={3}
          maxLength={4000}
          placeholder={t("quoteItems")}
          aria-label={t("quoteItems")}
          className={`${iconInputCls} rounded-2xl`}
        />
      </IconField>
      <label className="block">
        <span className={`${labelCls} flex items-center gap-1`}>
          <PaperclipIcon size={14} />
          {t("quoteFile")}
        </span>
        <input type="file" name="quote_file" accept="image/jpeg,image/png,image/webp,application/pdf" className={fileCls} />
      </label>
      <button type="submit" disabled={pending} className="btn btn-green w-full disabled:opacity-60">
        <SendIcon size={18} />
        {pending && progress ? t("uploading", { done: progress.done, total: progress.total }) : t("submitQuote")}
      </button>
      <Msg state={state} />
    </form>
  );
}

/** Admin: attach / replace the supplier's quote file on an existing quote. */
export function AttachQuoteFileForm({
  kind,
  quoteId,
  hasFile,
}: {
  kind: "stage" | "supplier";
  quoteId: string;
  hasFile: boolean;
}) {
  const t = useTranslations("build");
  const [open, setOpen] = useState(false);
  const { state, formAction, pending } = useUploadingAction(
    (prev, fd) => attachQuoteFile(kind, quoteId, prev, fd),
    "quote_file",
    "quote-file"
  );
  if (state?.ok) return <p className="mt-1 text-xs font-bold text-forest">{t("saved")}</p>;
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-forest underline underline-offset-2"
      >
        <PaperclipIcon size={14} />
        {hasFile ? t("replaceQuoteFile") : t("attachQuoteFile")}
      </button>
    );
  }
  return (
    <form action={formAction} className="mt-2 flex flex-wrap items-center gap-2">
      <input
        type="file"
        name="quote_file"
        required
        accept="image/jpeg,image/png,image/webp,application/pdf"
        aria-label={t("quoteFile")}
        className={fileCls}
      />
      <button type="submit" disabled={pending} className="btn btn-outline-green min-h-10 px-4 text-xs disabled:opacity-60">
        {t("attach")}
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
          <button type="button" disabled={pending} onClick={() => run(() => moveStage(stageId, -1))} aria-label={t("moveUp")} className="h-10 w-10 rounded-full border border-line text-sm">↑</button>
          <button type="button" disabled={pending} onClick={() => run(() => moveStage(stageId, 1))} aria-label={t("moveDown")} className="h-10 w-10 rounded-full border border-line text-sm">↓</button>
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
          <button type="submit" disabled={saving} className="btn btn-outline-green min-h-10 px-4 text-xs">{t("save")}</button>
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
      <button type="submit" disabled={pending} className="btn btn-primary min-h-10 px-5 text-sm disabled:opacity-60">{t("createBuild")}</button>
      <Msg state={state} />
    </form>
  );
}
