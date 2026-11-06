import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole } from "@/lib/auth/guard";

export default async function AdminClientsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, ["admin"]);
  const t = await getTranslations("admin.clients");

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email, whatsapp, country, role, created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  return (
    <div className="space-y-4">
      <h1 className="headline text-2xl text-forest">{t("title")}</h1>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted uppercase">
              <th className="px-4 py-3">{t("name")}</th>
              <th className="px-4 py-3">{t("email")}</th>
              <th className="px-4 py-3">WhatsApp</th>
              <th className="px-4 py-3">{t("country")}</th>
              <th className="px-4 py-3">{t("role")}</th>
            </tr>
          </thead>
          <tbody>
            {(profiles ?? []).map((p) => (
              <tr key={p.id} className="border-b border-line last:border-0">
                <td className="px-4 py-2.5 font-semibold text-ink">{p.full_name}</td>
                <td className="px-4 py-2.5 text-muted">{p.email}</td>
                <td className="px-4 py-2.5 text-muted">{p.whatsapp ?? "—"}</td>
                <td className="px-4 py-2.5 text-muted">{p.country ?? "—"}</td>
                <td className="px-4 py-2.5">
                  <span className="rounded-full bg-offwhite px-2 py-0.5 text-[11px] font-bold text-forest">
                    {p.role}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
