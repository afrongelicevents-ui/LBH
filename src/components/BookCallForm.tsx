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
import { CheckCircleIcon, WhatsAppIcon } from "./icons";
import { Link } from "@/i18n/navigation";

const inputCls = "ws-input";
const labelCls = "mb-2 block text-sm font-bold text-ink";
const SERVICES = ["land", "materials", "monitoring", "camera", "not-sure"] as const;
const SLOTS = ["morning", "afternoon", "evening", "weekend"] as const;

export interface BookingDefaults {
  name?: string;
  email?: string;
  whatsapp?: string;
  country?: string;
  /** preselected service (from ?service=) */
  service?: string;
}

export default function BookCallForm({ defaults = {} }: { defaults?: BookingDefaults }) {
  const t = useTranslations("bookPage");
  const tc = useTranslations("site.chat");
  const tw = useTranslations("site.ws");
  const [state, formAction, pending] = useActionState<BookingResult | null, FormData>(
    submitBooking,
    null
  );
  const submitKeepingValues = useSubmitKeepingValues(formAction);

  if (state?.status === "ok") {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center" data-testid="book-done">
        <span className="ws-tick">
          <CheckCircleIcon width={44} height={44} />
        </span>
        <h2 className="text-[2rem] leading-tight font-extrabold tracking-[-0.03em]">{t("successTitle")}</h2>
        <p className="max-w-[40ch] text-slate md:text-base">{t("successText")}</p>
        <p className="text-base font-semibold text-charcoal" data-testid="booking-promise">{tc("promise", { hours: state.replyHours ?? 24 })}</p>
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
        {!defaults.email && (
          <Link href="/signup" className="ds-btn ds-btn-primary mt-2">{tw("doneSignup")}</Link>
        )}
        <Link href="/" className="ds-btn ds-btn-outline">{tw("backHome")}</Link>
      </div>
    );
  }

  return (
    <form onSubmit={submitKeepingValues} className="flex flex-col gap-5" data-testid="book-form">
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

      <fieldset>
        <legend className={labelCls}>{tw("whatNeed")} *</legend>
        <div className="flex flex-wrap gap-2" data-testid="service-chips">
          {SERVICES.map((v) => (
            <label key={v} className="chip cursor-pointer has-[input:focus-visible]:outline-3 has-[input:focus-visible]:outline-forest">
              <input type="radio" name="service" value={v} required defaultChecked={defaults.service === v} className="sr-only" />
              {tw(`chips.${v}`)}
            </label>
          ))}
        </div>
        <p className="mt-2 text-[13px] text-slate">
          {tw("finishHint")} <Link href="/services/interiors#book" className="ds-link">{tw("finishLink")}</Link>
        </p>
      </fieldset>

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

        <label className="block sm:col-span-2">
          <span className={labelCls}>{t("description")}</span>
          <textarea
            name="description"
            rows={4}
            placeholder={t("descriptionHint")}
            className={inputCls}
          />
        </label>

        <fieldset className="sm:col-span-2">
          <legend className={labelCls}>{tw("pickTime")} *</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="slot-buttons">
            {SLOTS.map((v) => (
              <label key={v} className="ws-slot">
                <input type="radio" name="slot" value={v} required className="sr-only" />
                {tw(`slots.${v}`)}
                <small>{tw(`slots.${v}Hint`)}</small>
              </label>
            ))}
          </div>
          <span className="mt-2 block text-xs text-muted">{t("slotHint")}</span>
        </fieldset>

        <fieldset className="sm:col-span-2">
          <legend className={labelCls}>{t("callType")} *</legend>
          <div className="flex flex-wrap gap-2">
            <label className="chip cursor-pointer">
              <input type="radio" name="callType" value="phone" required defaultChecked className="sr-only" />
              {t("callPhone")}
            </label>
            <label className="chip cursor-pointer">
              <input type="radio" name="callType" value="video" className="sr-only" />
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
        className="ds-btn ds-btn-primary w-full px-7 disabled:opacity-60 sm:w-auto"
      >
        {tw("requestCall")}
      </button>
    </form>
  );
}
