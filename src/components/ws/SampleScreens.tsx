"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { PHOTOS } from "@/config/photos";
import { HarareClock } from "./HarareClock";

/** "This is a sample" notice with a sign-up button. */
export function SampleBar({ text }: { text: string }) {
  const t = useTranslations("site.ws");
  return (
    <div className="ws-sample-bar" data-testid="sample-bar">
      <div>
        <b className="block text-sm">{t("sampleBarTitle")}</b>
        <span className="block text-[13px] leading-snug text-slate">{text}</span>
      </div>
      <Link href="/signup" className="ds-btn ds-btn-primary min-h-11 flex-none px-4 text-[13px]" data-testid="sample-signup">
        {t("createFree")}
      </Link>
    </div>
  );
}

const CAMS = [PHOTOS.liveCam1, PHOTOS.liveCam2, PHOTOS.liveCam3];

/** SAMPLE live camera: three views and today's feed. */
export function SampleLive() {
  const t = useTranslations("site.ws");
  const [cam, setCam] = useState(0);
  const names = [t("cams.c1"), t("cams.c2"), t("cams.c3")];
  const feed = [
    { time: "07:42", k: 1, photo: PHOTOS.liveCam1 },
    { time: "10:15", k: 2, photo: PHOTOS.liveCam3 },
    { time: "13:30", k: 3, photo: PHOTOS.liveCam2 },
    { time: "16:05", k: 4, photo: null },
  ];
  return (
    <div className="grid gap-6 md:grid-cols-12 md:gap-12">
      <div className="md:col-span-7">
        <div className="relative aspect-[4/3] overflow-hidden rounded-[26px] bg-[#111]" data-testid="sample-cam">
          <Image src={CAMS[cam].src} alt={CAMS[cam].alt} fill sizes="(min-width: 768px) 55vw, 100vw" className="object-cover saturate-[.95]" priority />
          <div className="ws-scan" aria-hidden />
          <div className="ws-hud">
            <div className="flex items-center justify-between">
              <span className="ws-rec"><span className="ws-dot" />REC</span>
              <span>{t("camName", { n: cam + 1, name: names[cam].toUpperCase() })}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>{t("camPlace")}</span>
              <HarareClock template="{date} · {seconds} CAT" />
            </div>
          </div>
        </div>
        <div className="mt-2.5 grid grid-cols-3 gap-2" role="group" aria-label={t("liveTitlePage")}>
          {CAMS.map((c, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setCam(i)}
              aria-pressed={cam === i}
              className={`relative aspect-[4/3] overflow-hidden rounded-[16px] border-2 bg-[#222] ${cam === i ? "border-forest" : "border-transparent"}`}
            >
              <Image src={c.src} alt="" fill sizes="33vw" className="object-cover" />
              <span className="absolute bottom-1.5 left-2 text-[11px] font-bold text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]">{names[i]}</span>
            </button>
          ))}
        </div>
      </div>
      <section className="md:col-span-5" aria-labelledby="today">
        <div className="mb-1.5 flex items-baseline justify-between">
          <h2 id="today" className="text-2xl font-extrabold">{t("todayOnSite")}</h2>
          <span className="text-[13px] font-semibold text-slate"><HarareClock template="{date}" /></span>
        </div>
        {feed.map((f) => (
          <div key={f.k} className="grid grid-cols-[58px_1fr_76px] items-center gap-3 border-b border-rule py-3.5 last:border-0">
            <time className="font-serif text-lg font-bold">{f.time}</time>
            <div>
              <b className="block text-[15px]">{t(`feed.f${f.k}t`)}</b>
              <span className="text-[13px] text-slate">{t(`feed.f${f.k}`)}</span>
            </div>
            <span className="relative block h-[58px] w-[76px] overflow-hidden rounded-[12px] bg-sand">
              {f.photo ? <Image src={f.photo.src} alt="" fill sizes="76px" className="object-cover" /> : (
                <svg className="absolute inset-0 m-auto" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M8 13h8M8 17h5" /></svg>
              )}
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}

/** SAMPLE Build Account: money card, six stages (try "Review"), receipts. */
export function SampleBuild({ budget, spent }: { budget: string; spent: string; }) {
  const t = useTranslations("site.ws");
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState("");
  const okRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    okRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.documentElement.dataset.menu = "open";
    return () => {
      window.removeEventListener("keydown", onKey);
      delete document.documentElement.dataset.menu;
    };
  }, [open]);
  const stages = [
    { k: "foundation", note: t("stageNotes.paid1"), state: "done" },
    { k: "slab", note: t("stageNotes.paid2"), state: "done" },
    { k: "window", note: t("stageNotes.now"), state: "now" },
    { k: "wallplate", note: t("stageNotes.next"), state: "soon" },
    { k: "roof", note: t("stageNotes.roof"), state: "later" },
    { k: "finishes", note: t("stageNotes.finishes"), state: "later" },
  ];
  const receipts = [
    { k: 1, amount: "$520", photo: PHOTOS.liveCam3 },
    { k: 2, amount: "$1,540", photo: PHOTOS.liveCam2 },
    { k: 3, amount: "$2,900", photo: PHOTOS.liveCam1 },
  ];
  return (
    <div className="grid gap-8 md:grid-cols-12 md:gap-12">
      <div className="md:col-span-5">
        <div className="ws-money">
          <small className="text-[11px] font-extrabold tracking-[0.12em] text-slate">{t("leftToSpendCaps")}</small>
          <div className="ws-big num mt-2.5 mb-1 text-[3.6rem]">$23,550</div>
          <div className="num text-sm text-slate">{t("ofABudget", { budget })}</div>
          <div className="ws-bar mt-5 mb-2.5" aria-hidden><i style={{ width: "44%" }} /></div>
          <div className="num flex justify-between text-[13px] text-slate"><span>{t("spentAmount", { amount: spent })}</span><span>44%</span></div>
        </div>
        <section className="mt-8" aria-labelledby="receipts">
          <div className="mb-1 flex items-baseline justify-between">
            <h2 id="receipts" className="text-2xl font-extrabold">{t("receiptsTitle")}</h2>
          </div>
          {receipts.map((r) => (
            <div key={r.k} className="ws-row">
              <span className="ws-thumb"><Image src={r.photo.src} alt="" fill sizes="48px" className="object-cover" /></span>
              <div>
                <b className="block text-[15px]">{t(`receipts.r${r.k}t`)}</b>
                <span className="text-[13px] text-slate">{t(`receipts.r${r.k}`)}</span>
              </div>
              <strong className="num font-serif text-lg">{r.amount}</strong>
            </div>
          ))}
        </section>
      </div>
      <section className="md:col-span-7" aria-labelledby="stages">
        <div className="mb-1 flex items-baseline justify-between">
          <h2 id="stages" className="text-2xl font-extrabold">{t("stagesTitle")}</h2>
          <span className="text-[13px] font-semibold text-slate">{t("stagesCount", { n: 3 })}</span>
        </div>
        {stages.map((s, i) => (
          <div key={s.k} className={`ws-stg ${s.state === "done" ? "done" : s.state === "now" ? "now" : ""}`}>
            <div className="ic">{s.state === "done" ? "✓" : i + 1}</div>
            <div>
              <b>{t(`stages.${s.k}`)}</b>
              <span className="d">{s.note}</span>
            </div>
            {s.state === "now" ? (
              <button type="button" onClick={() => setOpen(true)} className="btn btn-primary min-h-11 px-4 text-[13px]" data-testid="sample-review">{t("review")}</button>
            ) : (
              <span className="ws-state">{t(`state.${s.state === "done" ? "done" : s.state}`)}</span>
            )}
          </div>
        ))}
      </section>

      {open && (
        <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-labelledby="approve-title">
          <button type="button" aria-label={t("notYet")} className="absolute inset-0 bg-[rgba(10,9,7,0.5)]" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 mx-auto max-w-lg rounded-t-[30px] bg-paper px-5 pt-2.5 pb-7 sm:bottom-6 sm:rounded-[30px]">
            <div className="mx-auto mb-4 h-[5px] w-11 rounded-full bg-line" aria-hidden />
            <h2 id="approve-title" className="text-[1.75rem] font-extrabold">{t("approveTitle")}</h2>
            <div className="my-4 grid grid-cols-3 gap-1.5">
              {[PHOTOS.liveCam2, PHOTOS.liveBand, PHOTOS.liveCam1].map((p, i) => (
                <span key={i} className="relative block aspect-square overflow-hidden rounded-[12px]"><Image src={p.src} alt={p.alt} fill sizes="30vw" className="object-cover" /></span>
              ))}
            </div>
            <ul className="mb-4 space-y-2.5">
              {[1, 2, 3].map((n) => (
                <li key={n} className="flex items-center gap-2.5 text-[15px]">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="text-ok"><path d="m5 12 5 5L20 7" /></svg>
                  {t(`approveChecks.c${n}`)}
                </li>
              ))}
            </ul>
            <p className="mb-4 text-[13px] text-slate">{t("approveNote")}</p>
            <div className="flex gap-2.5">
              <button type="button" onClick={() => setOpen(false)} className="ds-btn ds-btn-outline flex-1">{t("notYet")}</button>
              <button ref={okRef} type="button" onClick={() => { setOpen(false); setToast(t("approvedToast")); setTimeout(() => setToast(""), 2800); }} className="ds-btn ds-btn-primary flex-[1.4]">{t("approveStage")}</button>
            </div>
          </div>
        </div>
      )}
      {toast && (
        <p role="status" className="fixed inset-x-5 bottom-28 z-[70] mx-auto max-w-md rounded-[18px] bg-sand px-4 py-3.5 text-sm font-semibold shadow-lg lg:bottom-8">{toast}</p>
      )}
    </div>
  );
}
