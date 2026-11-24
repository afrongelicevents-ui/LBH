"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { askAssistant } from "@/app/actions/assistant";
import { ASSISTANT_FAQ_KEYS, ASSISTANT_FIRST_CHIPS, ASSISTANT_MAX_QUESTION } from "@/config/assistant";

type Turn = { id: number; role: "user" | "assistant"; content: string; handoff?: boolean };

const inputCls = "w-full rounded-[4px] border border-rule bg-white px-3 py-2 text-[15px] text-charcoal focus:border-forest focus:outline-none";
const SESSION_KEY = "lbh-assistant";

function readTurns(): Turn[] {
  try {
    const v = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "[]");
    return Array.isArray(v) ? v.slice(-30) : [];
  } catch {
    return [];
  }
}

/**
 * Instant answers in the chat: quick-question buttons (the FAQ — free, no AI)
 * and typed questions (Workers AI on Cloudflare, FAQ matching elsewhere).
 * "Talk to a person" hands over to the team chat with the last question filled in.
 */
export default function ChatAssistant({ onPerson }: { onPerson: (lastQuestion: string) => void }) {
  const t = useTranslations("site.chat.bot");
  const tf = useTranslations("site.faq");
  const locale = useLocale();
  // only rendered after the chat is opened (client side), so sessionStorage is safe here
  const [turns, setTurns] = useState<Turn[]>(() => (typeof window === "undefined" ? [] : readTurns()));
  const [text, setText] = useState("");
  const [allChips, setAllChips] = useState(false);
  const [busy, start] = useTransition();
  const bottom = useRef<HTMLDivElement>(null);
  const nextId = useRef(turns.reduce((m, x) => Math.max(m, x.id), 0) + 1);
  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(turns.slice(-30)));
    } catch {
      // private mode: keep it in memory only
    }
    bottom.current?.scrollIntoView({ block: "end" });
  }, [turns, busy]);

  const add = (role: Turn["role"], content: string, handoff?: boolean) =>
    setTurns((cur) => [...cur, { id: nextId.current++, role, content, handoff }]);

  const askFaq = (key: (typeof ASSISTANT_FAQ_KEYS)[number]) => {
    add("user", tf(`${key}.q` as never));
    add("assistant", tf(`${key}.a` as never).replace(/<[^>]+>/g, ""), key === "cost" || key === "pay");
  };

  const ask = (e: React.FormEvent) => {
    e.preventDefault();
    const q = text.trim();
    if (q.length < 2 || busy) return;
    const history = turns.slice(-6).map(({ role, content }) => ({ role, content: content.slice(0, 1200) }));
    add("user", q);
    setText("");
    start(async () => {
      const r = await askAssistant({ question: q, locale, history }).catch(() => null);
      if (!r || !r.ok) return add("assistant", t(r && !r.ok && r.error === "rate" ? "errors.rate" : "errors.error"), true);
      add("assistant", r.answer || t("notSure"), r.handoff || !r.answer);
    });
  };

  const lastQuestion = [...turns].reverse().find((x) => x.role === "user")?.content ?? "";
  const chips = allChips ? ASSISTANT_FAQ_KEYS : ASSISTANT_FAQ_KEYS.slice(0, ASSISTANT_FIRST_CHIPS);

  return (
    <>
      <div className="min-h-[220px] flex-1 space-y-3 overflow-y-auto px-5 py-4" data-testid="assistant-thread" aria-live="polite">
        <Bubble label={t("name")}>{t("hello")}</Bubble>

        <div>
          <p className="mb-2 text-xs font-semibold tracking-wide text-slate uppercase">{t("popular")}</p>
          <div className="flex flex-wrap gap-2">
            {chips.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => askFaq(k)}
                className="rounded-full border border-rule bg-white px-3 py-1.5 text-left text-sm text-charcoal hover:border-forest"
                data-testid={`assistant-chip-${k}`}
              >
                {tf(`${k}.q` as never)}
              </button>
            ))}
            {!allChips && (
              <button type="button" onClick={() => setAllChips(true)} className="px-2 py-1.5 text-sm font-semibold text-forest underline underline-offset-2" data-testid="assistant-more">
                {t("more")}
              </button>
            )}
          </div>
        </div>

        {turns.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[85%] rounded-[8px] bg-forest px-3.5 py-2.5 text-[15px] leading-snug whitespace-pre-wrap text-white" data-testid="assistant-msg-user">
                {m.content}
              </div>
            </div>
          ) : (
            <Bubble key={m.id} label={t("name")} testId="assistant-msg-bot">
              {m.content}
              {m.handoff && (
                <span className="mt-2 block">
                  <span className="mb-1.5 block text-xs text-slate">{t("handoffHint")}</span>
                  <button type="button" onClick={() => onPerson(lastQuestion)} className="ds-btn ds-btn-primary px-3 py-1.5 text-sm" data-testid="assistant-handoff">
                    {t("handoffCta")}
                  </button>
                </span>
              )}
            </Bubble>
          )
        )}
        {busy && <Bubble label={t("name")} testId="assistant-thinking">{t("thinking")}</Bubble>}
        <div ref={bottom} />
      </div>

      <form onSubmit={ask} className="border-t border-rule px-4 py-3">
        <div className="flex items-end gap-2">
          <label className="sr-only" htmlFor="assistant-input">{t("placeholder")}</label>
          <input
            id="assistant-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={ASSISTANT_MAX_QUESTION}
            placeholder={t("placeholder")}
            autoComplete="off"
            className={inputCls}
            data-testid="assistant-input"
          />
          <button type="submit" disabled={busy || text.trim().length < 2} className="ds-btn ds-btn-primary shrink-0 px-4 disabled:opacity-60" data-testid="assistant-ask">
            {t("ask")}
          </button>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate">
          <span>{t("disclaimer")}</span>
          <button type="button" onClick={() => onPerson(lastQuestion)} className="font-semibold text-forest underline underline-offset-2" data-testid="assistant-person">
            {t("handoffCta")} →
          </button>
        </div>
      </form>
    </>
  );
}

function Bubble({ label, children, testId }: { label: string; children: React.ReactNode; testId?: string }) {
  const t = useTranslations("site.chat.bot");
  return (
    <div className="flex justify-start">
      <div className="max-w-[88%] rounded-[8px] border border-rule bg-paper px-3.5 py-2.5 text-[15px] leading-snug whitespace-pre-wrap text-charcoal" data-testid={testId}>
        <span className="mb-0.5 block text-xs font-semibold text-stone-ink">
          {label} · <span className="font-normal">{t("autoLabel")}</span>
        </span>
        {children}
      </div>
    </div>
  );
}
