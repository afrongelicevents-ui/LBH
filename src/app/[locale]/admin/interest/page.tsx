import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole } from "@/lib/auth/guard";

export default async function AdminInterestPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, ["admin"]);
  const t = await getTranslations("admin.interest");

  const { data: interest } = await supabase
    .from("notify_interest")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  return (
    <div className="space-y-4">
      <h1 className="section-title text-2xl">{t("title")}</h1>
      <p className="text-sm text-muted">{t("hint")}</p>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted uppercase">
              <th className="px-4 py-3">{t("service")}</th>
              <th className="px-4 py-3">{t("email")}</th>
              <th className="px-4 py-3">WhatsApp</th>
              <th className="px-4 py-3">{t("date")}</th>
            </tr>
          </thead>
          <tbody>
            {(interest ?? []).map((i) => (
              <tr key={i.id} className="border-b border-line last:border-0">
                <td className="px-4 py-2.5 font-semibold text-forest">{i.service}</td>
                <td className="px-4 py-2.5 text-ink">{i.email ?? "—"}</td>
                <td className="px-4 py-2.5 text-ink">{i.whatsapp ?? "—"}</td>
                <td className="px-4 py-2.5 text-muted">
                  {new Date(i.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
