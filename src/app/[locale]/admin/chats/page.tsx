import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guard";

export default async function AdminChatsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, ["admin"]);
  const t = await getTranslations("admin.chats");

  const { data: messages } = await supabase
    .from("messages")
    .select("client_id, body, created_at, read_by_admin, profiles:client_id(full_name, email)")
    .order("created_at", { ascending: false })
    .limit(500);

  const threads = new Map<
    string,
    { name: string; last: string; at: string; unread: boolean }
  >();
  for (const m of messages ?? []) {
    const p = m.profiles as unknown as { full_name: string; email: string } | null;
    if (!threads.has(m.client_id)) {
      threads.set(m.client_id, {
        name: p?.full_name || p?.email || m.client_id,
        last: m.body,
        at: m.created_at,
        unread: !m.read_by_admin,
      });
    } else if (!m.read_by_admin) {
      threads.get(m.client_id)!.unread = true;
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="headline text-2xl text-forest">{t("title")}</h1>
      {threads.size === 0 && <p className="card p-6 text-center text-sm text-muted">{t("empty")}</p>}
      <ul className="space-y-2">
        {Array.from(threads.entries()).map(([clientId, th]) => (
          <li key={clientId}>
            <Link
              href={`/admin/chats/${clientId}`}
              className="card flex items-center justify-between gap-3 p-4 hover:shadow-(--shadow-card-hover)"
            >
              <div className="min-w-0">
                <p className="font-bold text-forest">{th.name}</p>
                <p className="truncate text-xs text-muted">{th.last}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {th.unread && <span className="h-2.5 w-2.5 rounded-full bg-accent" />}
                <span className="text-[10px] text-muted">
                  {new Date(th.at).toLocaleDateString()}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
