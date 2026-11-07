"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { isKnownCountry } from "@/lib/country";

/**
 * Country of residence: a choice of the usual countries, and "Other" opens a
 * box to type the country (required) — so we always know where people are.
 */
export default function CountryField({
  defaultValue = "",
  required = true,
  inputCls,
  labelCls,
  label,
}: {
  defaultValue?: string | null;
  required?: boolean;
  inputCls: string;
  labelCls: string;
  label: string;
}) {
  const t = useTranslations("bookPage");
  const stored = defaultValue ?? "";
  // A stored typed name (e.g. "Botswana") shows as Other + that name
  const initial = isKnownCountry(stored) ? stored : stored ? "other" : "";
  const [choice, setChoice] = useState(initial);
  const typed = stored && !isKnownCountry(stored) && stored !== "other" ? stored : "";

  return (
    <div className="space-y-3">
      <label className="block">
        <span className={labelCls}>
          {label}
          {required ? " *" : ""}
        </span>
        <select
          name="country"
          required={required}
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
          className={inputCls}
        >
          <option value="" disabled={required}>
            {required ? t("countryPlaceholder") : "—"}
          </option>
          <option value="uk">{t("countryUK")}</option>
          <option value="usa">{t("countryUSA")}</option>
          <option value="sa">{t("countrySA")}</option>
          <option value="zw">{t("countryZW")}</option>
          <option value="other">{t("countryOther")}</option>
        </select>
      </label>
      {choice === "other" && (
        <label className="block">
          <span className={labelCls}>{t("countryOtherName")} *</span>
          <input
            name="country_other"
            required
            minLength={2}
            maxLength={60}
            autoComplete="country-name"
            defaultValue={typed}
            placeholder={t("countryOtherPlaceholder")}
            className={inputCls}
            data-testid="country-other"
          />
        </label>
      )}
    </div>
  );
}
