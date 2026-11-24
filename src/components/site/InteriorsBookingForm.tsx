"use client";

import { useActionState, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import ReplyPromise from "@/components/site/OfficeStatus";
import CountryField from "@/components/CountryField";
import { useDirectUpload } from "@/lib/useDirectUpload";
import { guardAction, useSubmitKeepingValues } from "@/lib/useSubmitKeepingValues";
import { submitInteriors, type InteriorsResult } from "@/app/[locale]/(site)/services/interiors/actions";
import { BUDGETS, ROOMS, TIMELINES } from "@/lib/interiors";

const inputCls = "w-full rounded-[4px] border border-rule bg-paper px-3 py-2.5 text-[15px] text-charcoal focus:border-forest focus:outline-none";
const labelCls = "mb-1.5 block text-sm font-semibold text-charcoal";
const OFFLINE: InteriorsResult = { ok: false, error: "network" };

/**
 * "Book a design consultation". Signed-in customers can attach photos/plans
 * (uploaded straight to private storage); visitors leave their contact details
 * and get an LBH account invite by email.
 */
export default function InteriorsBookingForm({ signedIn }: { signedIn: boolean }) {
  const t = useTranslations("site.interiors.form");
  const tb = useTranslations("bookPage");
  const tc = useTranslations("common");
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const { upload, progress } = useDirectUpload();
  const [files, setFiles] = useState<File[]>([]);
  const [state, action, pending] = useActionState(
    guardAction(async (prev: InteriorsResult | null, fd: FormData) => {
      if (signedIn && files.length) {
        const up = await upload("client-document", files);
        if (!up.ok) return { ok: false, error: up.error === "size" ? "toobig" : up.error === "type" ? "filetype" : "upload" } as InteriorsResult;
        fd.set("uploads_json", JSON.stringify(up.refs));
      }
      const r = await submitInteriors(prev, fd);
      if (r.ok && r.signedIn && r.id) router.push(`/account/projects/${r.id}?new=interiors`);
      return r;
    }, OFFLINE),
    null
  );
  const submit = useSubmitKeepingValues(action);

  if (state?.ok && !state.signedIn) {
    return (
      <div role="status" className="border-l-2 border-forest bg-paper p-6" data-testid="interiors-booked">
        <p className="font-serif text-2xl text-forest">{t("thanksTitle")}</p>
        <p className="ds-body mt-2 text-base">{t("thanksText")}</p>
        <div className="mt-4">
          <ReplyPromise />
        </div>
      </div>
    );
  }

  const err = state && !state.ok ? state : null;
  return (
    <form
      ref={formRef}
      onSubmit={submit}
      className="grid gap-5 md:grid-cols-2"
      data-testid="interiors-form"
    >
      {!signedIn && (
        <>
          <label>
            <span className={labelCls}>{tb("name")} *</span>
            <input name="name" required minLength={2} maxLength={120} autoComplete="name" className={inputCls} />
          </label>
          <label>
            <span className={labelCls}>{tb("email")} *</span>
            <input name="email" type="email" required maxLength={254} autoComplete="email" className={inputCls} />
          </label>
          <label>
            <span className={labelCls}>{tb("whatsapp")} *</span>
            <input name="whatsapp" required inputMode="tel" autoComplete="tel" placeholder="+44 7700 900000" className={inputCls} />
          </label>
          <div>
            <CountryField inputCls={inputCls} labelCls={labelCls} label={tb("country")} />
          </div>
        </>
      )}

      <label className="md:col-span-2">
        <span className={labelCls}>{t("location")} *</span>
        <input name="location" required minLength={2} maxLength={160} placeholder={t("locationHint")} className={inputCls} />
      </label>

      <fieldset className="md:col-span-2">
        <legend className={labelCls}>{t("houseStatus")} *</legend>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {(["finished", "nearly_finished"] as const).map((v) => (
            <label key={v} className="flex items-center gap-2 text-[15px]">
              <input type="radio" name="house_status" value={v} required className="h-4 w-4 accent-forest" />
              {t(`status.${v}`)}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="md:col-span-2" data-testid="interiors-rooms">
        <legend className={labelCls}>{t("rooms")} *</legend>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
          {ROOMS.map((r) => (
            <label key={r} className="flex items-center gap-2 text-[15px]">
              <input type="checkbox" name="rooms" value={r} className="h-4 w-4 accent-forest" />
              {t(`room.${r}`)}
            </label>
          ))}
        </div>
      </fieldset>

      <label>
        <span className={labelCls}>{t("budget")} *</span>
        <select name="budget" required defaultValue="" className={inputCls}>
          <option value="" disabled>{t("choose")}</option>
          {BUDGETS.map((b) => (
            <option key={b} value={b}>{t(`budgets.${b}`)}</option>
          ))}
        </select>
      </label>
      <label>
        <span className={labelCls}>{t("timeline")} *</span>
        <select name="timeline" required defaultValue="" className={inputCls}>
          <option value="" disabled>{t("choose")}</option>
          {TIMELINES.map((x) => (
            <option key={x} value={x}>{t(`timelines.${x}`)}</option>
          ))}
        </select>
      </label>

      <label className="md:col-span-2">
        <span className={labelCls}>{t("styles")}</span>
        <textarea name="styles" rows={3} maxLength={2000} placeholder={t("stylesHint")} className={inputCls} />
      </label>

      <div className="md:col-span-2">
        <span className={labelCls}>{t("photos")}</span>
        {signedIn ? (
          <>
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 10))}
              className="block w-full text-sm file:mr-3 file:rounded-[4px] file:border file:border-charcoal file:bg-transparent file:px-3 file:py-2 file:text-sm file:font-semibold"
              data-testid="interiors-files"
            />
            <p className="mt-1 text-xs text-slate">{t("photosHint")}</p>
          </>
        ) : (
          <p className="text-sm text-slate">
            {t("photosAfter")} <Link href="/login?next=/services/interiors%23book" className="ds-link">{tc("login")}</Link>
          </p>
        )}
      </div>

      <label>
        <span className={labelCls}>{t("slot")} *</span>
        <select name="slot" required defaultValue="" className={inputCls}>
          <option value="" disabled>{t("choose")}</option>
          {(["morning", "afternoon", "evening", "weekend"] as const).map((s) => (
            <option key={s} value={s}>{t(`slots.${s}`)}</option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend className={labelCls}>{t("callType")} *</legend>
        <div className="flex gap-6 pt-2">
          {(["video", "phone"] as const).map((c) => (
            <label key={c} className="flex items-center gap-2 text-[15px]">
              <input type="radio" name="callType" value={c} required defaultChecked={c === "video"} className="h-4 w-4 accent-forest" />
              {t(`callTypes.${c}`)}
            </label>
          ))}
        </div>
      </fieldset>

      {/* honeypot */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />

      <div className="md:col-span-2">
        {err && (
          <p role="alert" className="mb-3 text-sm font-semibold text-red-700">
            {err.field === "rooms" ? t("errors.rooms") : t(`errors.${["rate", "toobig", "filetype", "upload", "network", "staff"].includes(err.error) ? err.error : "invalid"}`)}
          </p>
        )}
        <button type="submit" disabled={pending} className="ds-btn ds-btn-primary w-full disabled:opacity-60 sm:w-auto" data-testid="interiors-submit">
          {pending ? (progress ? t("uploading") : t("sending")) : t("submit")}
        </button>
        <p className="mt-3 text-xs text-slate">{signedIn ? t("noteSignedIn") : t("noteVisitor")}</p>
      </div>
    </form>
  );
}
