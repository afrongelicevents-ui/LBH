import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guard";
import { getReplySettings } from "@/lib/inbox";
import { hoursWaiting, waitingLabel } from "@/lib/officeHours";
import { AssignSelect, AutoRefresh, ChatStatusButton, VisitorReplyForm } from "@/components/admin/InboxAdmin";

/** One website chat: the visitor, the messages, a reply box. */
export default async function AdminVisitorChatPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, ["admin"]);
  const t = await getTranslations("admin.inbox");
  const { data: chat } = await supabase.from("visitor_chats").select("*").eq("id", id).maybeSingle();
  if (!chat) notFound();
  const [{ data: messages }, { data: assign }, { data: admins }, s] = await Promise.all([
    supabase.from("visitor_chat_messages").select("id, author, body, created_at, profiles:sender_id(full_name)").eq("chat_id", id).order("created_at"),
    supabase.from("inbox_assignments").select("assigned_to").eq("kind", "visitor_chat").eq("ref", id).maybeSingle(),
    supabase.from("profiles").select("id, full_name, email").eq("role", "admin").order("full_name"),
    getReplySettings(),
  ]);
  const late = chat.waiting_since && hoursWaiting(chat.waiting_since) >= s.replyHours;

  return (
    <div className="mx-auto max-w-3xl space-y-5" data-testid="admin-visitor-chat">
      <AutoRefresh seconds={20} />
      <div>
        <Link href="/admin/inbox" className="text-xs font-semibold text-muted hover:text-forest">← {t("title")}</Link>
        <h1 className="section-title mt-1 text-2xl">{chat.name}</h1>
        <p className="text-xs text-muted">
          {[chat.email, chat.phone].filter(Boolean).join(" · ")} · {t("language")}: {chat.locale.toUpperCase()}
          {chat.page ? ` · ${t("startedOn")} ${chat.page}` : ""}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {chat.waiting_since ? (
            <span className={`text-sm font-bold ${late ? "text-red-700" : "text-ink"}`}>{late ? `⚠ ${t("overdue")} · ` : ""}{t("waiting", { time: waitingLabel(chat.waiting_since) })}</span>
          ) : (
            <span className="text-sm font-semibold text-forest">{chat.status === "closed" ? t("closed") : t("answered")}</span>
          )}
          <AssignSelect kind="visitor_chat" refId={chat.id} value={assign?.assigned_to ?? null} admins={(admins ?? []).map((a) => ({ id: a.id, name: a.full_name || a.email }))} />
          <ChatStatusButton chatId={chat.id} status={chat.status} />
        </div>
      </div>

      <section className="card space-y-3 p-4" aria-label={t("messages")}>
        {(messages ?? []).map((m) => {
          const mine = m.author !== "visitor";
          const who = m.author === "visitor" ? chat.name : m.author === "auto" ? t("autoReply") : ((m.profiles as unknown as { full_name: string } | null)?.full_name ?? "LBH");
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${m.author === "visitor" ? "bg-offwhite text-ink" : m.author === "auto" ? "border border-line bg-white text-muted italic" : "bg-forest text-white"}`} data-testid={`admin-msg-${m.author}`}>
                <span className="mb-0.5 block text-[11px] font-bold opacity-80">{who}</span>
                {m.body}
                <span className="mt-1 block text-[10px] opacity-70">{new Date(m.created_at).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            </div>
          );
        })}
      </section>

      <section className="card p-4">
        <VisitorReplyForm chatId={chat.id} />
        {!chat.email && <p className="mt-2 text-xs text-muted">{t("noEmail", { phone: chat.phone })}</p>}
      </section>
    </div>
  );
}
