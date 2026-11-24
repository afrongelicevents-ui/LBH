"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useDirectUpload } from "@/lib/useDirectUpload";
import { guardAction, useSubmitKeepingValues } from "@/lib/useSubmitKeepingValues";
import { ROOMS } from "@/lib/interiors";
import {
  addInteriorItem,
  deleteInteriorItem,
  markInteriorItem,
  addInteriorPhoto,
  deleteInteriorPhoto,
  type InteriorAdminResult,
} from "@/app/[locale]/admin/interiorActions";

const inputCls = "w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink";
const OFFLINE: InteriorAdminResult = { ok: false, error: "error" };

function Msg({ r, ok }: { r: InteriorAdminResult | null; ok?: string }) {
  const t = useTranslations("admin.interiors");
  if (!r) return null;
  return r.ok ? (
    ok ? <p role="status" className="text-sm font-bold text-forest">{ok}</p> : null
  ) : (
    <p role="alert" className="text-sm font-bold text-red-700">{t(`error.${["invalid", "db", "chosen", "notChosen", "notBought", "filetype", "toobig", "upload"].includes(r.error) ? r.error : "error"}` as never)}</p>
  );
}

function RoomSelect({ name = "room" }: { name?: string }) {
  const tr = useTranslations("site.interiors.form.room");
  const t = useTranslations("admin.interiors");
  return (
    <select name={name} required defaultValue="" className={inputCls}>
      <option value="" disabled>{t("chooseRoom")}</option>
      {ROOMS.map((r) => (
        <option key={r} value={r}>{tr(r)}</option>
      ))}
    </select>
  );
}

/** LBH adds an option (item + shop + price) for a room. */
export function AddInteriorItemForm({ requestId }: { requestId: string }) {
  const t = useTranslations("admin.interiors");
  const router = useRouter();
  const [formKey, setFormKey] = useState(0);
  const [state, action, pending] = useActionState(
    guardAction(async (prev: InteriorAdminResult | null, fd: FormData) => {
      const r = await addInteriorItem(requestId, prev, fd);
      if (r.ok) {
        setFormKey((k) => k + 1);
        router.refresh();
      }
      return r;
    }, OFFLINE),
    null
  );
  const submit = useSubmitKeepingValues(action);
  return (
    <form key={formKey} onSubmit={submit} className="grid gap-3 sm:grid-cols-6" data-testid="interior-item-form">
      <label className="sm:col-span-2">
        <span className="mb-1 block text-xs font-semibold">{t("room")}</span>
        <RoomSelect />
      </label>
      <label className="sm:col-span-4">
        <span className="mb-1 block text-xs font-semibold">{t("name")}</span>
        <input name="name" required maxLength={160} className={inputCls} placeholder={t("nameHint")} />
      </label>
      <label className="sm:col-span-2">
        <span className="mb-1 block text-xs font-semibold">{t("shop")}</span>
        <input name="shop" maxLength={120} className={inputCls} />
      </label>
      <label>
        <span className="mb-1 block text-xs font-semibold">{t("qty")}</span>
        <input name="qty" type="number" min={1} max={999} defaultValue={1} className={inputCls} />
      </label>
      <label>
        <span className="mb-1 block text-xs font-semibold">{t("price")}</span>
        <input name="price" type="number" min={0.01} step={0.01} required className={inputCls} />
      </label>
      <label className="sm:col-span-2">
        <span className="mb-1 block text-xs font-semibold">{t("link")}</span>
        <input name="link" type="url" maxLength={500} className={inputCls} placeholder="https://" />
      </label>
      <label className="sm:col-span-6">
        <span className="mb-1 block text-xs font-semibold">{t("note")}</span>
        <input name="note" maxLength={500} className={inputCls} />
      </label>
      <div className="flex items-center gap-3 sm:col-span-6">
        <button type="submit" disabled={pending} className="btn btn-green min-h-10 px-4 text-sm disabled:opacity-60" data-testid="interior-item-add">
          {t("addItem")}
        </button>
        <Msg r={state} ok={t("itemAdded")} />
      </div>
    </form>
  );
}

/** Per-item admin actions: remove an option, mark bought (with receipt photo), mark delivered. */
export function InteriorItemActions({ id, status }: { id: string; status: string }) {
  const t = useTranslations("admin.interiors");
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const { upload } = useDirectUpload();
  const [busy, start] = useTransition();
  const [r, setR] = useState<InteriorAdminResult | null>(null);
  const run = (fn: () => Promise<InteriorAdminResult>) =>
    start(async () => {
      try {
        const res = await fn();
        setR(res);
        if (res.ok) router.refresh();
      } catch {
        setR(OFFLINE);
      }
    });
  const bought = (file?: File) =>
    run(async () => {
      const fd = new FormData();
      if (file) {
        const up = await upload("site-photo", [file]);
        if (!up.ok) return { ok: false, error: up.error === "size" ? "toobig" : up.error === "type" ? "filetype" : "upload" };
        fd.set("uploads_json", JSON.stringify(up.refs));
      }
      return markInteriorItem(id, "bought", fd);
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {(status === "option" || status === "declined") && (
        <button type="button" disabled={busy} onClick={() => run(() => deleteInteriorItem(id))} className="btn btn-outline-green min-h-9 px-3 text-xs disabled:opacity-60">
          {t("remove")}
        </button>
      )}
      {status === "chosen" && (
        <>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => bought(e.target.files?.[0])} data-testid="interior-receipt-input" />
          <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} className="btn btn-green min-h-9 px-3 text-xs disabled:opacity-60" data-testid="interior-bought-receipt">
            {t("boughtWithReceipt")}
          </button>
          <button type="button" disabled={busy} onClick={() => bought()} className="btn btn-outline-green min-h-9 px-3 text-xs disabled:opacity-60" data-testid="interior-bought">
            {t("bought")}
          </button>
        </>
      )}
      {status === "bought" && (
        <button type="button" disabled={busy} onClick={() => run(() => markInteriorItem(id, "delivered", null))} className="btn btn-green min-h-9 px-3 text-xs disabled:opacity-60" data-testid="interior-delivered">
          {t("delivered")}
        </button>
      )}
      <Msg r={r} />
    </div>
  );
}

/** Upload dated photos of a room. */
export function InteriorPhotoUpload({ requestId }: { requestId: string }) {
  const t = useTranslations("admin.interiors");
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { upload } = useDirectUpload();
  const [busy, start] = useTransition();
  const [r, setR] = useState<InteriorAdminResult | null>(null);
  function go(files: File[]) {
    const form = formRef.current;
    if (!form || !files.length) return;
    if (!form.reportValidity()) {
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    const fd = new FormData(form);
    start(async () => {
      try {
        const up = await upload("site-photo", files.slice(0, 10));
        if (!up.ok) return setR({ ok: false, error: up.error === "size" ? "toobig" : up.error === "type" ? "filetype" : "upload" });
        fd.set("uploads_json", JSON.stringify(up.refs));
        const res = await addInteriorPhoto(requestId, null, fd);
        setR(res);
        if (res.ok) router.refresh();
      } catch {
        setR(OFFLINE);
      } finally {
        if (fileRef.current) fileRef.current.value = "";
      }
    });
  }
  return (
    <form ref={formRef} onSubmit={(e) => e.preventDefault()} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" data-testid="interior-photo-form">
      <label>
        <span className="mb-1 block text-xs font-semibold">{t("room")}</span>
        <RoomSelect />
      </label>
      <label>
        <span className="mb-1 block text-xs font-semibold">{t("caption")}</span>
        <input name="caption" maxLength={200} className={inputCls} />
      </label>
      <div>
        <input ref={fileRef} type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => go(Array.from(e.target.files ?? []))} data-testid="interior-photo-input" />
        <button type="button" disabled={busy} onClick={() => formRef.current?.reportValidity() && fileRef.current?.click()} className="btn btn-outline-green min-h-10 px-4 text-sm disabled:opacity-60">
          {busy ? t("uploading") : t("addPhotos")}
        </button>
      </div>
      <div className="sm:col-span-3"><Msg r={r} ok={t("photosAdded")} /></div>
    </form>
  );
}

export function DeleteInteriorPhoto({ id }: { id: string }) {
  const t = useTranslations("admin.interiors");
  const router = useRouter();
  const [busy, start] = useTransition();
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() =>
        start(async () => {
          try {
            const r = await deleteInteriorPhoto(id);
            if (r.ok) router.refresh();
          } catch {
            /* offline: nothing changed */
          }
        })
      }
      className="text-xs font-semibold text-red-700 underline disabled:opacity-60"
    >
      {t("removePhoto")}
    </button>
  );
}
