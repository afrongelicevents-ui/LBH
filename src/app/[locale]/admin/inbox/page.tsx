import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guard";
import { loadInbox, type InboxItem } from "@/lib/inboxData";
import { getReplySettings } from "@/lib/inbox";
import { hoursWaiting, isOpenNow, waitingLabel } from "@/lib/officeHours";
import { AssignSelect, AutoRefresh, MarkAlertsSeen } from "@/components/admin/InboxAdmin";

/** Inbox: bookings, website chats and customer chats waiting for an answer. */
export default async function AdminInboxPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase, user } = await requireRole(locale, ["admin"]);
  const t = await getTranslations("admin.inbox");
  const [{ open, recent, admins }, s, { data: alerts }] = await Promise.all([
    loadInbox(supabase),
    getReplySettings(),
    supabase.from("admin_alerts").select("id, kind, ref, title, created_at, seen_by").order("created_at", { ascending: false }).limit(30),
  ]);
  const fresh = (alerts ?? []).filter((a) => !(a.seen_by as string[]).includes(user.id)).slice(0, 8);
  const online = isOpenNow(s.officeHours, s.officeTz);
  const overdue = open.filter((i) => hoursWaiting(i.at) >= s.replyHours).length;
  const nameOf = (id: string | null) => admins.find((a) => a.id === id)?.name ?? null;

  const Row = ({ i }: { i: InboxItem }) => {
    const late = i.open && hoursWaiting(i.at) >= s.replyHours;
    return (
      <li className={`card flex flex-wrap items-center gap-x-4 gap-y-2 p-4 ${late ? "border-2 border-red-600 bg-red-50" : ""}`} data-testid="inbox-item" data-kind={i.kind} data-late={late ? "1" : "0"}>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className={`badge ${i.kind === "booking" ? "badge-prog" : i.kind === "visitor_chat" ? "badge-done" : "badge-ok"}`}>{t(`kind.${i.kind}`)}</span>
            <Link href={i.href} className="font-bold text-forest hover:underline">{i.name}</Link>
          </p>
          {i.contact && <p className="mt-0.5 truncate text-xs text-muted">{i.contact}</p>}
          {i.preview && <p className="mt-1 line-clamp-2 text-sm text-ink">{i.preview}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {i.open ? (
            <span className={`text-sm font-bold whitespace-nowrap ${late ? "text-red-700" : "text-ink"}`} data-testid="inbox-waiting">
              {late ? `⚠ ${t("overdue")} · ` : ""}
              {t("waiting", { time: waitingLabel(i.at) })}
            </span>
          ) : (
            <span className="text-xs whitespace-nowrap text-muted">{new Date(i.at).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
          )}
          <AssignSelect kind={i.kind} refId={i.ref} value={i.assignedTo} admins={admins} />
          <Link href={i.href} className="btn btn-outline-green min-h-9 px-3 text-xs">{t("openItem")}</Link>
        </div>
        {!i.open && i.assignedTo && <p className="w-full text-xs text-muted">{t("handledBy", { name: nameOf(i.assignedTo) ?? "—" })}</p>}
      </li>
    );
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6" data-testid="admin-inbox">
      <AutoRefresh />
      <MarkAlertsSeen any={fresh.length > 0} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="section-title text-2xl">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted">
            {online ? t("statusOnline") : t("statusOffline")} · {t("promiseNote", { hours: s.replyHours })}
          </p>
        </div>
        <Link href="/admin/settings/replies" className="text-sm font-semibold text-forest underline underline-offset-2" data-testid="inbox-settings-link">{t("settingsLink")}</Link>
      </div>

      {fresh.length > 0 && (
        <section className="card border-accent bg-info p-4" data-testid="inbox-new">
          <h2 className="text-sm font-bold text-forest">{t("newTitle", { count: fresh.length })}</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {fresh.map((a) => (
              <li key={a.id} className="flex flex-wrap justify-between gap-2">
                <span className="text-ink">{a.title}</span>
                <span className="text-xs text-muted">{waitingLabel(a.created_at)} {t("ago")}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="open-title">
        <h2 id="open-title" className="text-base font-bold text-forest">
          {t("openTitle", { count: open.length })}
          {overdue > 0 && <span className="ml-2 text-sm text-red-700" data-testid="inbox-overdue">{t("overdueCount", { count: overdue })}</span>}
        </h2>
        {open.length === 0 ? (
          <p className="card mt-3 p-6 text-center text-sm text-muted">{t("empty")}</p>
        ) : (
          <ul className="mt-3 space-y-2">{open.map((i) => <Row key={`${i.kind}:${i.ref}`} i={i} />)}</ul>
        )}
      </section>

      {recent.length > 0 && (
        <section aria-labelledby="recent-title">
          <h2 id="recent-title" className="text-base font-bold text-forest">{t("recentTitle")}</h2>
          <ul className="mt-3 space-y-2">{recent.map((i) => <Row key={`${i.kind}:${i.ref}`} i={i} />)}</ul>
        </section>
      )}
    </div>
  );
}
