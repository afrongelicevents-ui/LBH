"use client";

import { useActionState, useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { waLink } from "@/config/site";
import { WhatsAppIcon, CloseIcon } from "@/components/icons";
import { useAuthProfile } from "@/components/auth/useAuthProfile";
import { guardAction, useSubmitKeepingValues } from "@/lib/useSubmitKeepingValues";
import { loadVisitorChat, sendVisitorMessage, startVisitorChat, type ChatMessage, type StartResult } from "@/app/actions/visitorChat";
import { StatusPill, useOfficeStatus } from "./OfficeStatus";
import ChatAssistant from "./ChatAssistant";

const KEY = "lbh-chat";
const SEEN = "lbh-chat-seen";
const inputCls = "w-full rounded-[4px] border border-rule bg-white px-3 py-2 text-[15px] text-charcoal focus:border-forest focus:outline-none";
type Saved = { chatId: string; token: string };

function readSaved(): Saved | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return v && typeof v.chatId === "string" && typeof v.token === "string" ? v : null;
  } catch {
    return null;
  }
}

function ChatBubbleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4h0A1.5 1.5 0 0 1 4 14.5z" />
      <path d="M8.5 8.5h7M8.5 11.5h4.5" />
    </svg>
  );
}

/**
 * Live chat on every public page. Visitors write with their name and email or
 * phone (no account); the thread is kept on this device. Signed-in customers
 * are sent to their account messages; staff don't see it. WhatsApp appears as
 * an extra option once the number is set.
 */
export default function ChatWidget() {
  const t = useTranslations("site.chat");
  const auth = useAuthProfile();
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unread, setUnread] = useState(false);
  // "bot": instant answers · "person": the team chat. Until chosen, visitors
  // start with quick answers and signed-in clients with their account messages.
  const [chosenMode, setMode] = useState<"bot" | "person" | null>(null);
  const [prefill, setPrefill] = useState("");
  const status = useOfficeStatus(open);
  const wa = waLink();

  // a thread from an earlier visit: show a dot when LBH has replied since
  useEffect(() => {
    const s = readSaved();
    if (!s) return;
    loadVisitorChat(s.chatId, s.token)
      .then((r) => {
        if (!r.ok) {
          if (r.error === "gone") localStorage.removeItem(KEY);
          else setSaved(s);
          return;
        }
        setSaved(s);
        setMessages(r.messages);
        setMode("person"); // an ongoing conversation with the team opens first
        const lastLbh = [...r.messages].reverse().find((m) => m.author === "lbh");
        if (lastLbh && lastLbh.at > (localStorage.getItem(SEEN) ?? "")) setUnread(true);
      })
      .catch(() => undefined);
  }, []);

  // open from anywhere: <a href="#chat"> or ?chat=open; "#chat-person" / ?chat=person opens the team chat
  useEffect(() => {
    const check = () => {
      const q = new URLSearchParams(location.search).get("chat");
      if (location.hash === "#chat-person" || q === "person") {
        setMode("person");
        setUnread(false);
        setOpen(true);
      } else if (location.hash === "#chat" || q === "open") {
        setUnread(false);
        setOpen(true);
      }
    };
    check();
    window.addEventListener("hashchange", check);
    return () => window.removeEventListener("hashchange", check);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.chat = open ? "open" : "closed";
    if (open) localStorage.setItem(SEEN, new Date().toISOString());
  }, [open]);
  const openChat = () => {
    setUnread(false);
    setOpen(true);
  };

  if (auth.status === "in" && auth.profile.role !== "client") return null; // staff
  const mode = chosenMode ?? (auth.status === "in" ? "person" : "bot");

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={openChat}
          aria-label={t("open")}
          data-testid="chat-open"
          className="chat-float fixed right-0 bottom-24 z-50 flex h-11 w-[30px] items-center justify-center rounded-l-full bg-forest text-white shadow-lg sm:right-6 sm:bottom-6 sm:h-12 sm:w-auto sm:gap-2 sm:rounded-full sm:px-5 sm:text-[15px] sm:font-semibold sm:hover:bg-[#123227]"
        >
          <ChatBubbleIcon className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
          <span className="hidden sm:inline">{t("open")}</span>
          {unread && <span className="absolute top-1 left-1 h-2.5 w-2.5 rounded-full bg-[#d4553b] ring-2 ring-white sm:top-0 sm:right-1 sm:left-auto" data-testid="chat-unread" />}
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-modal="false"
          aria-labelledby="chat-title"
          data-testid="chat-panel"
          className="fixed inset-x-0 bottom-0 z-[60] flex max-h-[88svh] flex-col rounded-t-[10px] border border-rule bg-ivory shadow-2xl sm:inset-x-auto sm:right-6 sm:bottom-6 sm:max-h-[min(640px,85vh)] sm:w-[380px] sm:rounded-[8px]"
        >
          <div className="flex items-start justify-between gap-3 border-b border-rule px-5 pt-4 pb-3">
            <div>
              <h2 id="chat-title" className="font-serif text-xl text-charcoal">{t("title")}</h2>
              <StatusPill s={status} className="mt-0.5" />
              <div role="tablist" aria-label={t("title")} className="mt-2 inline-flex rounded-full border border-rule bg-white p-0.5 text-sm">
                {(["bot", "person"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={mode === m}
                    onClick={() => setMode(m)}
                    className={`rounded-full px-3 py-1 font-semibold ${mode === m ? "bg-forest text-white" : "text-slate hover:text-charcoal"}`}
                    data-testid={`chat-tab-${m}`}
                  >
                    {m === "bot" ? t("bot.tabBot") : t("bot.tabPerson")}
                  </button>
                ))}
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label={t("close")} className="-mr-2 rounded p-2 text-slate hover:text-charcoal" data-testid="chat-close">
              <CloseIcon width={20} height={20} />
            </button>
          </div>

          {mode === "bot" ? (
            <ChatAssistant
              onPerson={(q) => {
                setPrefill(q);
                setMode("person");
              }}
            />
          ) : auth.status === "in" ? (
            <div className="space-y-4 px-5 py-5">
              <p className="ds-body">{t("signedInText")}</p>
              <Link href="/account/support" className="ds-btn ds-btn-primary w-full" data-testid="chat-account-link">
                {t("signedInCta")}
              </Link>
              {wa && <WhatsAppOption href={wa} />}
            </div>
          ) : saved ? (
            <Thread saved={saved} messages={messages} setMessages={setMessages} onReset={() => { localStorage.removeItem(KEY); setSaved(null); setMessages([]); }} wa={wa} />
          ) : (
            <StartForm
              wa={wa}
              defaultMessage={prefill}
              onStarted={(r) => {
                const s = { chatId: r.chatId, token: r.token };
                localStorage.setItem(KEY, JSON.stringify(s));
                setSaved(s);
                setMessages(r.messages);
              }}
            />
          )}
        </div>
      )}
    </>
  );
}

function WhatsAppOption({ href }: { href: string }) {
  const t = useTranslations("site.chat");
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 rounded-[4px] border border-rule bg-white px-4 py-2.5 text-sm font-semibold text-charcoal hover:border-[#25d366]" data-testid="chat-whatsapp">
      <WhatsAppIcon width={18} height={18} className="text-[#25d366]" />
      {t("whatsapp")}
    </a>
  );
}

function StartForm({ onStarted, wa, defaultMessage = "" }: { onStarted: (r: Extract<StartResult, { ok: true }>) => void; wa: string | null; defaultMessage?: string }) {
  const t = useTranslations("site.chat");
  const locale = useLocale();
  const pathname = usePathname();
  const [state, action, pending] = useActionState(
    guardAction(async (prev: StartResult | null, fd: FormData) => {
      const r = await startVisitorChat(prev, fd);
      if (r.ok) onStarted(r);
      return r;
    }, { ok: false, error: "network" } as StartResult),
    null
  );
  const submit = useSubmitKeepingValues(action);
  const err = state && !state.ok ? state.error : null;
  return (
    <form onSubmit={submit} className="flex min-h-0 flex-col gap-3 overflow-y-auto px-5 py-4" data-testid="chat-start">
      <p className="text-sm text-slate">{t("intro")}</p>
      <label>
        <span className="mb-1 block text-sm font-semibold text-charcoal">{t("name")} *</span>
        <input name="name" required maxLength={120} autoComplete="name" className={inputCls} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label>
          <span className="mb-1 block text-sm font-semibold text-charcoal">{t("email")}</span>
          <input name="email" type="email" maxLength={254} autoComplete="email" className={inputCls} />
        </label>
        <label>
          <span className="mb-1 block text-sm font-semibold text-charcoal">{t("phone")}</span>
          <input name="phone" type="tel" inputMode="tel" maxLength={40} autoComplete="tel" placeholder="+44…" className={inputCls} />
        </label>
      </div>
      <p className="-mt-1 text-xs text-slate">{t("contactHint")}</p>
      <label>
        <span className="mb-1 block text-sm font-semibold text-charcoal">{t("message")} *</span>
        <textarea name="message" required rows={3} maxLength={4000} defaultValue={defaultMessage} placeholder={t("messagePlaceholder")} className={inputCls} />
      </label>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="page" value={pathname} />
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      {err && (
        <p role="alert" className="text-sm font-semibold text-[#a0461a]">
          {t(`errors.${["contact", "rate", "network", "invalid"].includes(err) ? err : "error"}` as never)}
        </p>
      )}
      <button type="submit" disabled={pending} className="ds-btn ds-btn-primary w-full disabled:opacity-60" data-testid="chat-send">
        {pending ? t("sending") : t("send")}
      </button>
      {wa && <WhatsAppOption href={wa} />}
    </form>
  );
}

function Thread({
  saved,
  messages,
  setMessages,
  onReset,
  wa,
}: {
  saved: Saved;
  messages: ChatMessage[];
  setMessages: (m: ChatMessage[]) => void;
  onReset: () => void;
  wa: string | null;
}) {
  const t = useTranslations("site.chat");
  const [text, setText] = useState("");
  const [busy, start] = useTransition();
  const [failed, setFailed] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    const r = await loadVisitorChat(saved.chatId, saved.token).catch(() => null);
    if (r?.ok) setMessages(r.messages);
    else if (r && r.error === "gone") onReset();
  }, [saved, setMessages, onReset]);

  // new replies appear on screen while the chat is open
  useEffect(() => {
    void refresh();
    const id = setInterval(refresh, 8000);
    return () => clearInterval(id);
  }, [refresh]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
    localStorage.setItem(SEEN, new Date().toISOString());
  }, [messages.length]);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    start(async () => {
      setFailed(false);
      const r = await sendVisitorMessage(saved.chatId, saved.token, body).catch(() => null);
      if (r?.ok) {
        setMessages(r.messages);
        setText("");
      } else setFailed(true);
    });
  };

  return (
    <>
      <div className="min-h-[200px] flex-1 space-y-3 overflow-y-auto px-5 py-4" data-testid="chat-thread" aria-live="polite">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.author === "visitor" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-[8px] px-3.5 py-2.5 text-[15px] leading-snug whitespace-pre-wrap ${
                m.author === "visitor" ? "bg-forest text-white" : m.author === "auto" ? "border border-rule bg-paper text-charcoal" : "border border-rule bg-white text-charcoal"
              }`}
              data-testid={`chat-msg-${m.author}`}
            >
              {m.author !== "visitor" && <span className="mb-0.5 block text-xs font-semibold text-stone-ink">{t("lbh")}</span>}
              {m.body}
              <span className={`mt-1 block text-[11px] ${m.author === "visitor" ? "text-white/70" : "text-slate"}`}>
                {new Date(m.at).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          </div>
        ))}
        <div ref={bottom} />
      </div>
      <form onSubmit={send} className="border-t border-rule px-4 py-3">
        <div className="flex items-end gap-2">
          <label className="sr-only" htmlFor="chat-reply">{t("message")}</label>
          <textarea
            id="chat-reply"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            maxLength={4000}
            placeholder={t("replyPlaceholder")}
            className={`${inputCls} resize-none`}
            data-testid="chat-input"
          />
          <button type="submit" disabled={busy || !text.trim()} className="ds-btn ds-btn-primary shrink-0 px-4 disabled:opacity-60" data-testid="chat-reply-send">
            {t("send")}
          </button>
        </div>
        {failed && <p role="alert" className="mt-1.5 text-xs font-semibold text-[#a0461a]">{t("errors.network")}</p>}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate">
          <span>{t("emailReplyNote")}</span>
          <button type="button" onClick={onReset} className="underline hover:text-charcoal" data-testid="chat-new">{t("newChat")}</button>
        </div>
        {wa && <div className="mt-2"><WhatsAppOption href={wa} /></div>}
      </form>
    </>
  );
}
