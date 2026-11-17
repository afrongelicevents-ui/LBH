"use client";

import { useSubmitKeepingValues } from "@/lib/useSubmitKeepingValues";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { waLink } from "@/config/site";
import CountryField from "./CountryField";
import {
  submitBooking,
  type BookingResult,
} from "@/app/[locale]/(site)/book-a-call/actions";
import { ArrowRightIcon, CheckCircleIcon, WhatsAppIcon } from "./icons";

const inputCls =
  "w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink placeholder:text-muted/70 focus:border-forest focus:outline-none";
const labelCls = "mb-1.5 block text-sm font-semibold text-ink";

export interface BookingDefaults {
  name?: string;
  email?: string;
  whatsapp?: string;
  country?: string;
}

export default function BookCallForm({ defaults = {} }: { defaults?: BookingDefaults }) {
  const t = useTranslations("bookPage");
  const [state, formAction, pending] = useActionState<BookingResult | null, FormData>(
    submitBooking,
    null
  );
  const submitKeepingValues = useSubmitKeepingValues(formAction);

  if (state?.status === "ok") {
    return (
      <div className="card flex flex-col items-center gap-4 p-8 text-center">
        <CheckCircleIcon width={48} height={48} className="text-forest" />
        <h2 className="text-xl font-bold text-forest">{t("successTitle")}</h2>
        <p className="text-sm text-muted md:text-base">{t("successText")}</p>
        {waLink() && (
          <a
            href={waLink()!}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-green mt-2"
          >
            <WhatsAppIcon width={18} height={18} />
            {t("successWhatsapp")}
          </a>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submitKeepingValues} className="card p-6 md:p-8">
      {state && (
        <p
          role="alert"
          className="mb-5 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"
        >
          {state.status === "invalid"
            ? state.field === "email"
              ? t("errorEmail")
              : state.field === "country_other"
                ? t("errorCountry")
                : state.field === "whatsapp"
                ? t("errorWhatsapp")
                : t("errorRequired")
            : state.status === "rate"
              ? t("errorRate")
              : t("errorGeneric")}
        </p>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className={labelCls}>{t("name")} *</span>
          <input name="name" required autoComplete="name" defaultValue={defaults.name ?? ""} className={inputCls} />
        </label>

        <label className="block">
          <span className={labelCls}>{t("email")} *</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            defaultValue={defaults.email ?? ""}
            className={inputCls}
          />
        </label>

        <label className="block">
          <span className={labelCls}>{t("whatsapp")} *</span>
          <input
            name="whatsapp"
            type="tel"
            required
            placeholder={t("whatsappHint")}
            autoComplete="tel"
            defaultValue={defaults.whatsapp ?? ""}
            className={inputCls}
          />
        </label>

        <div className="block">
          <CountryField label={t("country")} defaultValue={defaults.country} inputCls={inputCls} labelCls={labelCls} />
        </div>

        <label className="block">
          <span className={labelCls}>{t("service")} *</span>
          <select name="service" required defaultValue="" className={inputCls}>
            <option value="" disabled>
              {t("servicePlaceholder")}
            </option>
            <option value="land">{t("serviceLand")}</option>
            <option value="materials">{t("serviceMaterials")}</option>
            <option value="monitoring">{t("serviceMonitoring")}</option>
            <option value="camera">{t("serviceCamera")}</option>
            <option value="not-sure">{t("serviceNotSure")}</option>
          </select>
        </label>

        <label className="block sm:col-span-2">
          <span className={labelCls}>{t("description")}</span>
          <textarea
            name="description"
            rows={4}
            placeholder={t("descriptionHint")}
            className={inputCls}
          />
        </label>

        <label className="block">
          <span className={labelCls}>{t("slot")} *</span>
          <select name="slot" required defaultValue="" className={inputCls}>
            <option value="" disabled>
              {t("slotPlaceholder")}
            </option>
            <option value="morning">{t("slotMorning")}</option>
            <option value="afternoon">{t("slotAfternoon")}</option>
            <option value="evening">{t("slotEvening")}</option>
            <option value="weekend">{t("slotWeekend")}</option>
          </select>
          <span className="mt-1.5 block text-xs text-muted">{t("slotHint")}</span>
        </label>

        <fieldset>
          <legend className={labelCls}>{t("callType")} *</legend>
          <div className="flex gap-4 pt-1.5">
            <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
              <input
                type="radio"
                name="callType"
                value="phone"
                required
                defaultChecked
                className="h-4 w-4 accent-[#163a2b]"
              />
              {t("callPhone")}
            </label>
            <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
              <input
                type="radio"
                name="callType"
                value="video"
                className="h-4 w-4 accent-[#163a2b]"
              />
              {t("callVideo")}
            </label>
          </div>
        </fieldset>

        {/* Honeypot field — hidden from humans, bots fill it in */}
        <div aria-hidden className="hidden">
          <label>
            website
            <input name="website" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary mt-7 w-full px-7 disabled:opacity-60 sm:w-auto"
      >
        {t("submit")}
        <ArrowRightIcon width={20} height={20} />
      </button>
    </form>
  );
}
