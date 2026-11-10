"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useDirectUpload } from "@/lib/useDirectUpload";
import { guardAction, useSubmitKeepingValues } from "@/lib/useSubmitKeepingValues";
import {
  saveProject,
  setProjectPublished,
  deleteProject,
  addProjectPhoto,
  deleteProjectPhoto,
  setProjectsInNav,
  type ProjectResult,
} from "@/app/[locale]/admin/projectActions";

const inputCls = "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink";
const OFFLINE: ProjectResult = { ok: false, error: "error" };

function Msg({ r, ok }: { r: ProjectResult | null; ok?: string }) {
  const t = useTranslations("admin.projects");
  if (!r) return null;
  return r.ok ? (ok ? <p role="status" className="text-sm font-bold text-forest">{ok}</p> : null) : (
    <p role="alert" className="text-sm font-bold text-red-700">{t(`error.${r.error}` as never)}</p>
  );
}

export function ProjectForm({ project }: { project?: { id: string; title: string; location: string; stage: string; summary: string } }) {
  const t = useTranslations("admin.projects");
  const router = useRouter();
  const [state, action, pending] = useActionState(
    guardAction(async (prev: ProjectResult | null, fd: FormData) => {
      const r = await saveProject(project?.id ?? null, prev, fd);
      if (r.ok) router.refresh();
      return r;
    }, OFFLINE),
    null
  );
  const submit = useSubmitKeepingValues(action);
  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2" data-testid={project ? `project-edit-${project.id}` : "project-new"}>
      <label className="sm:col-span-2">
        <span className="mb-1 block text-xs font-semibold">{t("fTitle")}</span>
        <input name="title" required minLength={2} maxLength={120} defaultValue={project?.title} className={inputCls} />
      </label>
      <label>
        <span className="mb-1 block text-xs font-semibold">{t("fLocation")}</span>
        <input name="location" maxLength={120} defaultValue={project?.location} className={inputCls} placeholder={t("fLocationHint")} />
      </label>
      <label>
        <span className="mb-1 block text-xs font-semibold">{t("fStage")}</span>
        <input name="stage" maxLength={80} defaultValue={project?.stage} className={inputCls} placeholder={t("fStageHint")} />
      </label>
      <label className="sm:col-span-2">
        <span className="mb-1 block text-xs font-semibold">{t("fSummary")}</span>
        <textarea name="summary" maxLength={1200} rows={3} defaultValue={project?.summary} className={inputCls} />
      </label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={pending} className="btn btn-green min-h-10 px-4 text-sm disabled:opacity-60">{project ? t("save") : t("create")}</button>
        <Msg r={state} ok={t("saved")} />
      </div>
    </form>
  );
}

export function ProjectPhotoUpload({ projectId }: { projectId: string }) {
  const t = useTranslations("admin.projects");
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const { upload } = useDirectUpload();
  const [busy, start] = useTransition();
  const [r, setR] = useState<ProjectResult | null>(null);
  const [caption, setCaption] = useState("");
  const [taken, setTaken] = useState("");
  function go(file: File | undefined) {
    if (!file) return;
    start(async () => {
      try {
        const up = await upload("site-photo", [file]);
        if (!up.ok || !up.refs.length) return setR({ ok: false, error: "upload" });
        const fd = new FormData();
        fd.set("uploads_json", JSON.stringify(up.refs));
        fd.set("caption", caption);
        fd.set("taken_on", taken);
        const res = await addProjectPhoto(projectId, null, fd);
        setR(res);
        if (res.ok) {
          setCaption("");
          router.refresh();
        }
      } catch {
        setR(OFFLINE);
      } finally {
        if (ref.current) ref.current.value = "";
      }
    });
  }
  return (
    <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end" data-testid={`project-photo-${projectId}`}>
      <label>
        <span className="mb-1 block text-xs font-semibold">{t("fCaption")}</span>
        <input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={200} className={inputCls} />
      </label>
      <label>
        <span className="mb-1 block text-xs font-semibold">{t("fTaken")}</span>
        <input type="date" value={taken} onChange={(e) => setTaken(e.target.value)} className={inputCls} />
      </label>
      <div>
        <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => go(e.target.files?.[0])} data-testid="project-photo-input" />
        <button type="button" disabled={busy} onClick={() => ref.current?.click()} className="btn btn-outline-green min-h-10 px-4 text-sm disabled:opacity-60">
          {busy ? t("uploading") : t("addPhoto")}
        </button>
      </div>
      <div className="sm:col-span-3"><Msg r={r} ok={t("photoAdded")} /></div>
    </div>
  );
}

export function ProjectButtons({ id, published, hasPhotos }: { id: string; published: boolean; hasPhotos: boolean }) {
  const t = useTranslations("admin.projects");
  const router = useRouter();
  const [busy, start] = useTransition();
  const [r, setR] = useState<ProjectResult | null>(null);
  const run = (fn: () => Promise<ProjectResult>) =>
    start(async () => {
      try {
        const res = await fn();
        setR(res);
        if (res.ok) router.refresh();
      } catch {
        setR(OFFLINE);
      }
    });
  return (
    <span className="flex flex-wrap items-center gap-3">
      <button type="button" disabled={busy || (!published && !hasPhotos)} onClick={() => run(() => setProjectPublished(id, !published))} className="btn btn-green min-h-9 px-3 text-xs disabled:opacity-50" data-testid={`publish-${id}`}>
        {published ? t("unpublish") : t("publish")}
      </button>
      <button type="button" disabled={busy} onClick={() => confirm(t("deleteConfirm")) && run(() => deleteProject(id))} className="text-xs font-bold text-red-700 underline">
        {t("delete")}
      </button>
      <Msg r={r} />
    </span>
  );
}

export function DeletePhotoButton({ id }: { id: string }) {
  const t = useTranslations("admin.projects");
  const router = useRouter();
  const [busy, start] = useTransition();
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => confirm(t("deletePhotoConfirm")) && start(async () => { await deleteProjectPhoto(id).catch(() => null); router.refresh(); })}
      className="text-xs font-bold text-red-700 underline"
    >
      {t("deletePhoto")}
    </button>
  );
}

export function MenuToggle({ on, publishedCount }: { on: boolean; publishedCount: number }) {
  const t = useTranslations("admin.projects");
  const router = useRouter();
  const [busy, start] = useTransition();
  const [r, setR] = useState<ProjectResult | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3" data-testid="projects-menu-toggle">
      <span className="text-sm">{on ? t("menuOn") : t("menuOff")}</span>
      <button
        type="button"
        disabled={busy || (!on && publishedCount === 0)}
        onClick={() => start(async () => { try { const res = await setProjectsInNav(!on); setR(res); if (res.ok) router.refresh(); } catch { setR(OFFLINE); } })}
        className="btn btn-outline-green min-h-9 px-3 text-xs disabled:opacity-50"
      >
        {on ? t("menuHide") : t("menuShow")}
      </button>
      {!on && publishedCount === 0 && <span className="text-xs text-muted">{t("menuNeedsProject")}</span>}
      <Msg r={r} />
    </div>
  );
}
