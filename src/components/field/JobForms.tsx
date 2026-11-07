"use client";

import { useRef, useState, useActionState } from "react";
import { useTranslations } from "next-intl";
import {
  saveVisit,
  uploadMedia,
  requestExtraCost,
  saveReportDraft,
  type ActionResult,
} from "@/app/[locale]/field/actions";
import { useDirectUpload } from "@/lib/useDirectUpload";

const inputCls =
  "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink focus:border-forest focus:outline-none";
const labelCls = "mb-1 block text-xs font-semibold text-ink";

function Feedback({ state }: { state: ActionResult | null }) {
  const t = useTranslations("field");
  if (!state) return null;
  return state.ok ? (
    <p className="mt-2 text-xs font-bold text-forest">{t("saved")}</p>
  ) : (
    <p role="alert" className="mt-2 text-xs font-bold text-red-700">
      {t(`error.${state.error}` as never)}
    </p>
  );
}

// ---------- visit checklist ----------
export function VisitForm({
  jobId,
  visit,
}: {
  jobId: string;
  visit: Record<string, unknown>;
}) {
  const t = useTranslations("field");
  const bound = saveVisit.bind(null, jobId);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    bound,
    null
  );
  const m = (visit.measurements ?? {}) as Record<string, number | null>;

  const checks = [
    ["arrived", Boolean(visit.arrived)],
    ["council_officer_present", Boolean(visit.council_officer_present)],
    ["pegs_shown", Boolean(visit.pegs_shown)],
  ] as const;

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        {checks.map(([name, checked]) => (
          <label key={name} className="flex min-h-10 items-center gap-2.5 text-sm text-ink">
            <input
              type="checkbox"
              name={name}
              defaultChecked={checked}
              className="h-5 w-5 rounded accent-[#163a2b]"
            />
            {t(`visit.${name}` as never)}
          </label>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {(["length_m", "width_m", "area_sqm"] as const).map((f) => (
          <label key={f} className="block">
            <span className={labelCls}>{t(`visit.${f}`)}</span>
            <input
              name={f}
              type="number"
              step="0.01"
              min="0"
              defaultValue={m[f] ?? ""}
              className={inputCls}
            />
          </label>
        ))}
      </div>
      <label className="block">
        <span className={labelCls}>{t("visit.title_notes")}</span>
        <textarea
          name="title_notes"
          rows={2}
          defaultValue={String(visit.title_notes ?? "")}
          className={inputCls}
        />
      </label>
      <label className="block">
        <span className={labelCls}>{t("visit.findings")}</span>
        <textarea
          name="findings"
          rows={3}
          defaultValue={String(visit.findings ?? "")}
          className={inputCls}
        />
      </label>
      <button type="submit" disabled={pending} className="btn btn-green min-h-10 text-sm disabled:opacity-60">
        {t("saveVisit")}
      </button>
      <Feedback state={state} />
    </form>
  );
}

// ---------- media capture with device GPS ----------
export function MediaUploadForm({
  jobId,
  kind,
}: {
  jobId: string;
  kind: "photo" | "video" | "receipt";
}) {
  const t = useTranslations("field");
  const { upload } = useDirectUpload();
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    async (prev, fd) => {
      // Phone photos/videos go straight to storage — no size limit from the web server.
      const file = fd.get("file");
      fd.delete("file");
      const up = await upload("staff-media", file instanceof File ? [file] : []);
      if (!up.ok) return { ok: false as const, error: up.error === "size" ? "toobig" : up.error === "type" ? "filetype" : "error" };
      if (up.refs.length === 0) return { ok: false as const, error: "invalid" };
      fd.set("uploads_json", JSON.stringify(up.refs));
      return uploadMedia(jobId, prev, fd);
    },
    null
  );
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsState, setGpsState] = useState<"idle" | "ok" | "denied">("idle");
  const formRef = useRef<HTMLFormElement>(null);

  function captureGps() {
    if (!navigator.geolocation) return setGpsState("denied");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsState("ok");
      },
      () => setGpsState("denied"),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="device_lat" value={gps?.lat ?? ""} />
      <input type="hidden" name="device_lng" value={gps?.lng ?? ""} />
      <input
        type="file"
        name="file"
        required
        accept={kind === "video" ? "video/mp4,video/quicktime,video/webm" : "image/jpeg,image/png,image/webp"}
        capture={kind === "photo" ? "environment" : undefined}
        onChange={captureGps}
        className="block w-full text-xs text-muted file:mr-3 file:rounded-full file:border-0 file:bg-forest file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
      />
      {kind === "receipt" && (
        <label className="block">
          <span className={labelCls}>{t("receiptAmount")} *</span>
          <input name="amount" required placeholder="12.50" className={inputCls} />
        </label>
      )}
      <input name="note" placeholder={t("mediaNote")} maxLength={500} className={inputCls} />
      <p className="text-[11px] text-muted">
        {gpsState === "ok" && gps
          ? `GPS ✓ ${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}`
          : gpsState === "denied"
            ? t("gpsDenied")
            : t("gpsHint")}
      </p>
      <button type="submit" disabled={pending} className="btn btn-gold min-h-10 text-sm disabled:opacity-60">
        {pending ? t("uploading") : t(`upload.${kind}` as never)}
      </button>
      <Feedback state={state} />
    </form>
  );
}

// ---------- extra cost ----------
export function ExtraCostForm({ jobId }: { jobId: string }) {
  const t = useTranslations("field");
  const bound = requestExtraCost.bind(null, jobId);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    bound,
    null
  );
  if (state?.ok) {
    return <p className="text-sm font-bold text-forest">{t("extraCostSent")}</p>;
  }
  return (
    <form action={formAction} className="space-y-3">
      <label className="block">
        <span className={labelCls}>{t("extraTitle")} *</span>
        <input name="title" required maxLength={200} className={inputCls} />
      </label>
      <label className="block">
        <span className={labelCls}>{t("extraReason")} *</span>
        <textarea name="reason" required rows={2} maxLength={2000} className={inputCls} />
      </label>
      <label className="block">
        <span className={labelCls}>{t("extraAmount")} *</span>
        <input name="amount" required placeholder="25.00" className={inputCls} />
      </label>
      <button type="submit" disabled={pending} className="btn btn-outline-green min-h-10 text-sm disabled:opacity-60">
        {t("sendExtraCost")}
      </button>
      <Feedback state={state} />
    </form>
  );
}

// ---------- report draft ----------
const SECTION_FIELDS = [
  "stand_details",
  "legal_findings",
  "council_confirmation",
  "measurements",
  "red_flags",
  "next_steps",
  "costs_summary",
] as const;

export function ReportDraftForm({
  jobId,
  report,
}: {
  jobId: string;
  report: { verdict: string | null; sections: Record<string, string>; status: string } | null;
}) {
  const t = useTranslations("field");
  const tr = useTranslations("portal.report.section");
  const bound = saveReportDraft.bind(null, jobId);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    bound,
    null
  );
  const locked = report ? !["draft", "changes_requested"].includes(report.status) : false;

  if (locked) {
    return (
      <p className="text-sm font-bold text-forest">
        {t(`reportStatus.${report!.status}` as never)}
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      {report?.status === "changes_requested" && (
        <p className="rounded-xl border border-gold bg-gold/10 px-3 py-2 text-xs font-bold text-forest">
          {t("changesRequested")}
        </p>
      )}
      <label className="block">
        <span className={labelCls}>{t("verdict")} *</span>
        <select name="verdict" defaultValue={report?.verdict ?? ""} className={inputCls}>
          <option value="">—</option>
          <option value="clear">{t("verdicts.clear")}</option>
          <option value="concerns">{t("verdicts.concerns")}</option>
          <option value="red_flags">{t("verdicts.red_flags")}</option>
        </select>
      </label>
      {SECTION_FIELDS.map((f) => (
        <label key={f} className="block">
          <span className={labelCls}>{tr(f)}</span>
          <textarea
            name={f}
            rows={2}
            maxLength={8000}
            defaultValue={report?.sections?.[f] ?? ""}
            className={inputCls}
          />
        </label>
      ))}
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={pending}
          className="btn btn-outline-green min-h-10 text-sm disabled:opacity-60"
        >
          {t("saveDraft")}
        </button>
        <button
          type="submit"
          name="submit"
          value="1"
          disabled={pending}
          className="btn btn-gold min-h-10 text-sm disabled:opacity-60"
        >
          {t("submitToAdmin")}
        </button>
      </div>
      <p className="text-[11px] text-muted">{t("submitNote")}</p>
      <Feedback state={state} />
    </form>
  );
}
