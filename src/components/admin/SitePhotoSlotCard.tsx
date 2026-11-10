"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useDirectUpload } from "@/lib/useDirectUpload";
import { saveSitePhoto, resetSitePhoto, type SitePhotoResult } from "@/app/[locale]/admin/sitePhotoActions";
import type { SitePhotoDef } from "@/config/sitePhotos";
import { StatusBadge } from "@/components/ui/Portal";
import { CameraIcon } from "@/components/ui/PortalIcons";

const ACCEPT = "image/jpeg,image/png,image/webp";

/** How the photo looks on the website, drawn the same way as the real section. */
function Preview({ def, src }: { def: SitePhotoDef; src: string }) {
  const t = useTranslations();
  /* eslint-disable @next/next/no-img-element -- previews of not-yet-saved photos (blob: URLs) */
  if (def.preview === "hero") {
    return (
      <div className="relative aspect-[16/7] w-full overflow-hidden rounded-xl" data-testid="photo-preview">
        <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover object-[70%_40%]" />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to right, rgba(22,58,43,0.95) 0%, rgba(22,58,43,0.85) 30%, rgba(22,58,43,0.4) 50%, rgba(22,58,43,0) 65%)",
          }}
        />
        <div className="relative flex h-full max-w-[55%] flex-col justify-center p-4 text-white">
          <p className="headline text-base sm:text-2xl">{t("home.hero.headline")}</p>
          <p className="mt-1 text-[10px] text-white/85 sm:text-xs">{t("home.hero.subline")}</p>
          <span className="mt-2 w-fit rounded-full bg-white px-3 py-1 text-[10px] font-bold text-ink">{t("common.bookFirstCall")}</span>
        </div>
      </div>
    );
  }
  if (def.preview === "banner") {
    return (
      <div className="relative aspect-[16/5] w-full overflow-hidden rounded-xl" data-testid="photo-preview">
        <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to right, rgba(22,58,43,0.15) 0%, rgba(22,58,43,0.55) 35%, rgba(22,58,43,0.93) 62%, rgba(22,58,43,0.95) 100%)",
          }}
        />
        <div className="relative flex h-full items-center gap-3 p-3">
          <div className="w-1/4 shrink-0 rounded-md border-2 border-ink/80 bg-ink/80">
            <div className="relative aspect-video overflow-hidden rounded">
              <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <span className="absolute top-0.5 left-0.5 rounded bg-red-600 px-1 text-[7px] font-extrabold text-white">
                {t("home.live.liveBadge")}
              </span>
            </div>
          </div>
          <p className="headline flex-1 text-right text-sm text-white sm:text-xl">{t("home.live.title")}</p>
        </div>
      </div>
    );
  }
  if (def.preview === "logo") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-line bg-white p-3" data-testid="photo-preview">
        <img src={src} alt="" className="h-12 w-auto" />
        <span aria-hidden className="h-9 w-px bg-line" />
        <span className="text-sm font-extrabold tracking-wide text-forest uppercase">{t("common.brandUpper")}</span>
      </div>
    );
  }
  // service card (homepage + services page)
  return (
    <div className="card flex max-w-sm p-1.5 sm:max-w-xs sm:flex-col sm:p-0" data-testid="photo-preview">
      <div className="relative aspect-3/2 w-[35%] shrink-0 overflow-hidden rounded-lg sm:w-full sm:rounded-none">
        <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" />
      </div>
      <p className="p-3 text-sm font-bold text-forest">{t(`servicesData.${def.slot}.title` as never)}</p>
    </div>
  );
  /* eslint-enable @next/next/no-img-element */
}

export default function SitePhotoSlotCard({
  def,
  currentUrl,
  custom,
}: {
  def: SitePhotoDef;
  currentUrl: string;
  custom: { width: number | null; height: number | null; updatedAt: string; kind: "lbh" | "stock" | null; credit: string } | null;
}) {
  const t = useTranslations("admin.photos");
  const router = useRouter();
  const { upload } = useDirectUpload();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [result, setResult] = useState<SitePhotoResult | null>(null);
  const [busy, startBusy] = useTransition();
  const [confirmReset, setConfirmReset] = useState(false);
  const [kind, setKind] = useState<"" | "lbh" | "stock">("");
  const [credit, setCredit] = useState("");
  const needsKind = def.slot !== "logo";

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  function choose(f: File | undefined) {
    setResult(null);
    if (!f) return;
    if (!ACCEPT.split(",").includes(f.type)) {
      setResult({ ok: false, error: "filetype" });
      return;
    }
    const url = URL.createObjectURL(f);
    setFile(f);
    setPreview(url);
    const img = new Image();
    img.onload = () => setSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = url;
  }

  function cancel() {
    setFile(null);
    setPreview(null);
    setSize(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function save() {
    if (!file) return;
    if (needsKind && !kind) return setResult({ ok: false, error: "kind" });
    if (kind === "stock" && credit.trim().length < 3) return setResult({ ok: false, error: "credit" });
    startBusy(async () => {
      try {
        const up = await upload("site-photo", [file]);
        if (!up.ok || up.refs.length === 0) {
          setResult({ ok: false, error: !up.ok && up.error === "size" ? "toobig" : !up.ok && up.error === "type" ? "filetype" : "upload" });
          return;
        }
        const fd = new FormData();
        fd.set("uploads_json", JSON.stringify(up.refs));
        fd.set("kind", kind);
        fd.set("credit", credit);
        const res = await saveSitePhoto(def.slot, null, fd);
        setResult(res);
        if (res.ok) {
          cancel();
          router.refresh();
        }
      } catch {
        setResult({ ok: false, error: "upload" });
      }
    });
  }

  function reset() {
    startBusy(async () => {
      try {
        const res = await resetSitePhoto(def.slot);
        setResult(res);
        setConfirmReset(false);
        if (res.ok) router.refresh();
      } catch {
        setResult({ ok: false, error: "upload" });
      }
    });
  }

  const tooSmall = size && Math.max(size.w, size.h) < def.minWidth;

  return (
    <section className="card p-4 sm:p-5" data-testid={`photo-slot-${def.slot}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-extrabold text-ink">{t(`slot.${def.slot}.name`)}</h2>
          <p className="text-xs text-muted">{t(`slot.${def.slot}.where`)}</p>
        </div>
        {custom ? (
          <StatusBadge tone={custom.kind ? "ok" : "grey"}>
            {custom.kind === "lbh" ? t("kindLbh") : custom.kind === "stock" ? t("kindStock") : t("kindNone")}
          </StatusBadge>
        ) : (
          <StatusBadge tone="grey">{t("default")}</StatusBadge>
        )}
      </div>

      <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div>
          <p className="mb-1 text-[11px] font-bold tracking-wide text-muted uppercase">{preview ? t("newPhoto") : t("currentPhoto")}</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- current photo or local preview */}
          <img
            src={preview ?? currentUrl}
            alt={t(`slot.${def.slot}.name`)}
            className={`w-full rounded-xl border border-line bg-offwhite ${def.preview === "logo" ? "max-h-32 object-contain p-2" : "aspect-3/2 object-cover"}`}
            data-testid="photo-current"
          />
          {custom?.width && !preview && (
            <p className="mt-1 text-[11px] text-muted">
              {custom.width} × {custom.height} px · {new Date(custom.updatedAt).toLocaleString()}
            </p>
          )}
          {size && (
            <p className={`mt-1 text-[11px] font-semibold ${tooSmall ? "text-red-700" : "text-muted"}`}>
              {size.w} × {size.h} px{tooSmall ? ` · ${t("tooSmall", { min: def.minWidth })}` : ""}
            </p>
          )}
        </div>
        <div>
          <p className="mb-1 text-[11px] font-bold tracking-wide text-muted uppercase">{t("livePreview")}</p>
          <Preview def={def} src={preview ?? currentUrl} />
          <p className="mt-2 rounded-xl bg-ok-soft/60 p-2.5 text-xs text-ink">
            <strong>{t("tip")}:</strong> {t(`slot.${def.slot}.tip`, { min: def.minWidth })}
          </p>
        </div>
      </div>

      {file && needsKind && (
        <fieldset className="mt-3 rounded-xl border border-line p-3" data-testid="photo-kind">
          <legend className="px-1 text-xs font-bold text-ink">{t("kindQuestion")}</legend>
          <label className="flex items-start gap-2 py-1 text-sm">
            <input type="radio" name={`kind-${def.slot}`} value="lbh" checked={kind === "lbh"} onChange={() => setKind("lbh")} className="mt-1 accent-forest" />
            <span><strong>{t("kindLbh")}</strong> — {t("kindLbhHint")}</span>
          </label>
          <label className="flex items-start gap-2 py-1 text-sm">
            <input type="radio" name={`kind-${def.slot}`} value="stock" checked={kind === "stock"} onChange={() => setKind("stock")} className="mt-1 accent-forest" />
            <span><strong>{t("kindStock")}</strong> — {t("kindStockHint")}</span>
          </label>
          {kind === "stock" && (
            <input
              value={credit}
              onChange={(e) => setCredit(e.target.value)}
              maxLength={200}
              placeholder={t("creditPlaceholder")}
              aria-label={t("creditLabel")}
              className="mt-2 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm"
              data-testid="photo-credit"
            />
          )}
        </fieldset>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          aria-label={t("replace")}
          data-testid="photo-input"
          onChange={(e) => choose(e.target.files?.[0])}
        />
        {!file ? (
          <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className="btn btn-green min-h-10 px-4 text-sm">
            <CameraIcon size={18} />
            {t("replace")}
          </button>
        ) : (
          <>
            <button type="button" onClick={save} disabled={busy} className="btn btn-green min-h-10 px-4 text-sm disabled:opacity-60" data-testid="photo-save">
              {busy ? t("saving") : t("save")}
            </button>
            <button type="button" onClick={cancel} disabled={busy} className="btn btn-outline-green min-h-10 px-4 text-sm">
              {t("cancel")}
            </button>
          </>
        )}
        {custom && !file && (
          confirmReset ? (
            <span className="flex flex-wrap items-center gap-2 rounded-xl bg-info px-3 py-1.5 text-xs">
              {t("resetConfirm")}
              <button type="button" onClick={reset} disabled={busy} className="font-bold text-red-700 underline" data-testid="photo-reset-yes">
                {t("resetYes")}
              </button>
              <button type="button" onClick={() => setConfirmReset(false)} className="font-bold text-forest underline">
                {t("cancel")}
              </button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirmReset(true)} disabled={busy} className="text-sm font-bold text-forest underline underline-offset-2" data-testid="photo-reset">
              {t("reset")}
            </button>
          )
        )}
      </div>
      {result?.ok && (
        <p role="status" className="mt-2 text-sm font-bold text-forest">
          {t("savedLive")}
        </p>
      )}
      {result && !result.ok && (
        <p role="alert" className="mt-2 text-sm font-bold text-red-700">
          {t(`error.${["auth", "toobig", "filetype", "heic", "upload", "db"].includes(result.error) ? result.error : "error"}` as never)}
        </p>
      )}
    </section>
  );
}
