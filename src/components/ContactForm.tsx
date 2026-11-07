"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { site } from "@/config/site";
import { ArrowRightIcon } from "./icons";

/**
 * Contact form. Until the portal backend lands (Phase 3+), submissions open
 * the visitor's email client with the message pre-filled — no data is stored.
 */
export default function ContactForm() {
  const t = useTranslations("contactPage");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const subject = encodeURIComponent(`Website enquiry from ${name}`);
    const body = encodeURIComponent(message);
    window.location.href = `mailto:${site.email}?subject=${subject}&body=${body}`;
  }

  const inputCls =
    "w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink placeholder:text-muted/70 focus:border-forest focus:outline-none";

  return (
    <form onSubmit={submit} className="card mt-8 p-6 md:p-7">
      <h2 className="text-lg font-bold text-forest">{t("formTitle")}</h2>
      <div className="mt-4 space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-ink">
            {t("name")}
          </span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputCls}
            autoComplete="name"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-ink">
            {t("message")}
          </span>
          <textarea
            required
            rows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className={inputCls}
          />
        </label>
      </div>
      <button type="submit" className="btn btn-primary mt-5 px-7">
        {t("send")}
        <ArrowRightIcon width={18} height={18} />
      </button>
    </form>
  );
}
