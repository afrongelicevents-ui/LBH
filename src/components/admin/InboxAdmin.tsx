"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { guardAction, useSubmitKeepingValues } from "@/lib/useSubmitKeepingValues";
import { DAYS, type OfficeHours } from "@/lib/officeHours";
import {
  assignInbox,
  replyVisitorChat,
  setVisitorChatStatus,
  markAlertsSeen,
  saveReplySettings,
  type InboxResult,
} from "@/app/[locale]/admin/inboxActions";

const inputCls = "w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink";
const OFFLINE: InboxResult = { ok: false, error: "error" };

/** Who owns this booking / chat. Saves on change. */
export function AssignSelect({ kind, refId, value, admins }: { kind: string; refId: string; value: string | null; admins: { id: string; name: string }[] }) {
  const t = useTranslations("admin.inbox");
  const router = useRouter();
  const [busy, start] = useTransition();
  const [failed, setFailed] = useState(false);
  return (
    <span className="inline-flex items-center gap-1.5">
      <label className="sr-only" htmlFor={`assign-${refId}`}>{t("assignedTo")}</label>
      <select
        id={`assign-${refId}`}
        defaultValue={value ?? ""}
        disabled={busy}
        onChange={(e) =>
          start(async () => {
            setFailed(false);
            const r = await assignInbox(kind, refId, e.target.value).catch(() => OFFLINE);
            if (r.ok) router.refresh();
            else setFailed(true);
          })
        }
        className="max-w-[11rem] rounded-lg border border-line bg-paper px-2 py-1.5 text-xs text-ink disabled:opacity-60"
        data-testid="inbox-assign"
      >
        <option value="">{t("unassigned")}</option>
        {admins.map((a) => (
          <option key={a.id} value={a.id}>{a.name}</option>
        ))}
      </select>
      {failed && <span role="alert" className="text-xs font-bold text-red-700">!</span>}
    </span>
  );
}

/** Clears this admin's "new" badge once they have seen the Inbox. */
export function MarkAlertsSeen({ any }: { any: boolean }) {
  const router = useRouter();
  const done = useRef(false);
  useEffect(() => {
    if (!any || done.current) return;
    done.current = true;
    const id = setTimeout(() => void markAlertsSeen().then(() => router.refresh()).catch(() => undefined), 1500);
    return () => clearTimeout(id);
  }, [any, router]);
  return null;
}

/** Keeps the Inbox up to date while it is open. */
export function AutoRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}

export function VisitorReplyForm({ chatId }: { chatId: string }) {
  const t = useTranslations("admin.inbox");
  const router = useRouter();
  const [key, setKey] = useState(0);
  const [state, action, pending] = useActionState(
    guardAction(async (prev: InboxResult | null, fd: FormData) => {
      const r = await replyVisitorChat(chatId, prev, fd);
      if (r.ok) {
        setKey((k) => k + 1);
        router.refresh();
      }
      return r;
    }, OFFLINE),
    null
  );
  const submit = useSubmitKeepingValues(action);
  return (
    <form key={key} onSubmit={submit} className="space-y-2" data-testid="inbox-reply-form">
      <label className="block">
        <span className="mb-1 block text-xs font-semibold">{t("reply")}</span>
        <textarea name="body" required rows={4} maxLength={4000} className={inputCls} data-testid="inbox-reply" />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="btn btn-green min-h-10 px-4 text-sm disabled:opacity-60" data-testid="inbox-reply-send">
          {pending ? t("sending") : t("sendReply")}
        </button>
        <span className="text-xs text-muted">{t("replyHint")}</span>
        {state && !state.ok && <span role="alert" className="text-sm font-bold text-red-700">{t("failed")}</span>}
        {state?.ok && <span role="status" className="text-sm font-bold text-forest">{t("sent")}</span>}
      </div>
    </form>
  );
}

export function ChatStatusButton({ chatId, status }: { chatId: string; status: "open" | "closed" }) {
  const t = useTranslations("admin.inbox");
  const router = useRouter();
  const [busy, start] = useTransition();
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() =>
        start(async () => {
          const r = await setVisitorChatStatus(chatId, status === "open" ? "closed" : "open").catch(() => OFFLINE);
          if (r.ok) router.refresh();
        })
      }
      className="btn btn-outline-green min-h-9 px-3 text-xs disabled:opacity-60"
      data-testid="inbox-chat-status"
    >
      {status === "open" ? t("close") : t("reopen")}
    </button>
  );
}


export function ReplySettingsForm({ replyHours, officeHours, officeTz, alertEmails }: { replyHours: number; officeHours: OfficeHours; officeTz: string; alertEmails: string[] }) {
  const t = useTranslations("admin.inbox");
  const router = useRouter();
  const [state, action, pending] = useActionState(
    guardAction(async (prev: InboxResult | null, fd: FormData) => {
      const r = await saveReplySettings(prev, fd);
      if (r.ok) router.refresh();
      return r;
    }, OFFLINE),
    null
  );
  const submit = useSubmitKeepingValues(action);
  return (
    <form onSubmit={submit} className="card space-y-5 p-5" data-testid="reply-settings">
      <label className="block max-w-xs">
        <span className="mb-1 block text-sm font-bold text-forest">{t("replyHours")}</span>
        <input name="reply_hours" type="number" min={1} max={168} required defaultValue={replyHours} className={inputCls} />
        <span className="mt-1 block text-xs text-muted">{t("replyHoursHint")}</span>
      </label>

      <fieldset>
        <legend className="text-sm font-bold text-forest">{t("officeHours")}</legend>
        <p className="mt-0.5 text-xs text-muted">{t("officeHoursHint", { tz: officeTz })}</p>
        <div className="mt-3 space-y-2">
          {DAYS.map((d) => {
            const h = officeHours[d];
            return (
              <div key={d} className="grid grid-cols-[6.5rem_1fr_1fr] items-center gap-2 sm:grid-cols-[8rem_9rem_9rem]">
                <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <input type="checkbox" name={`${d}_on`} defaultChecked={Boolean(h)} className="h-4 w-4 accent-forest" />
                  {t(`days.${d}`)}
                </label>
                <input type="time" name={`${d}_open`} defaultValue={h?.open ?? "08:00"} aria-label={`${t(`days.${d}`)} ${t("opens")}`} className={inputCls} />
                <input type="time" name={`${d}_close`} defaultValue={h?.close ?? "17:00"} aria-label={`${t(`days.${d}`)} ${t("closes")}`} className={inputCls} />
              </div>
            );
          })}
        </div>
      </fieldset>

      <label className="block">
        <span className="mb-1 block text-sm font-bold text-forest">{t("alertEmails")}</span>
        <textarea name="alert_emails" rows={2} defaultValue={alertEmails.join(", ")} placeholder="info@letsbuildhome.co.zw" className={inputCls} />
        <span className="mt-1 block text-xs text-muted">{t("alertEmailsHint")}</span>
      </label>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn btn-green min-h-10 px-4 text-sm disabled:opacity-60" data-testid="reply-settings-save">
          {t("save")}
        </button>
        {state?.ok && <span role="status" className="text-sm font-bold text-forest">{t("saved")}</span>}
        {state && !state.ok && <span role="alert" className="text-sm font-bold text-red-700">{t(`error.${["hours", "times", "emails"].includes(state.error) ? state.error : "error"}` as never)}</span>}
      </div>
    </form>
  );
}
