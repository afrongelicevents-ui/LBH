import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guard";

export default async function AdminRequestsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, ["admin"]);
  const t = await getTranslations("admin.requests");

  const { data: requests } = await supabase
    .from("service_requests")
    .select("id, title, type, status, created_at, profiles:client_id(full_name, email)")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="space-y-4">
      <h1 className="headline text-2xl text-forest">{t("title")}</h1>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted uppercase">
              <th className="px-4 py-3">{t("request")}</th>
              <th className="px-4 py-3">{t("client")}</th>
              <th className="px-4 py-3">{t("type")}</th>
              <th className="px-4 py-3">{t("status")}</th>
              <th className="px-4 py-3">{t("created")}</th>
            </tr>
          </thead>
          <tbody>
            {(requests ?? []).map((r) => {
              const client = r.profiles as unknown as {
                full_name: string;
                email: string;
              } | null;
              return (
                <tr key={r.id} className="border-b border-line last:border-0 hover:bg-offwhite">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/requests/${r.id}`}
                      className="font-bold text-forest hover:underline"
                    >
                      {r.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink">{client?.full_name || client?.email}</td>
                  <td className="px-4 py-3 text-muted">{r.type}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-offwhite px-2.5 py-1 text-[11px] font-bold text-forest">
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
