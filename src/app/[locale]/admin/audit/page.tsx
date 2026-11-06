import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole } from "@/lib/auth/guard";

export default async function AdminAuditPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, ["admin"]);
  const t = await getTranslations("admin.audit");

  const { data: entries } = await supabase
    .from("audit_log")
    .select("*")
    .order("id", { ascending: false })
    .limit(300);

  return (
    <div className="space-y-4">
      <h1 className="headline text-2xl text-forest">{t("title")}</h1>
      <div className="card overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-line text-left text-muted uppercase">
              <th className="px-4 py-3">{t("when")}</th>
              <th className="px-4 py-3">{t("actor")}</th>
              <th className="px-4 py-3">{t("action")}</th>
              <th className="px-4 py-3">{t("entity")}</th>
              <th className="px-4 py-3">{t("data")}</th>
            </tr>
          </thead>
          <tbody>
            {(entries ?? []).map((e) => (
              <tr key={e.id} className="border-b border-line align-top last:border-0">
                <td className="px-4 py-2 whitespace-nowrap text-muted">
                  {new Date(e.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-2 text-muted">{e.actor_role}</td>
                <td className="px-4 py-2 font-bold text-forest">{e.action}</td>
                <td className="px-4 py-2 text-ink">
                  {e.entity}
                  {e.entity_id ? ` ${String(e.entity_id).slice(0, 8)}` : ""}
                </td>
                <td className="max-w-md px-4 py-2 break-all text-muted">
                  {JSON.stringify(e.data)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
