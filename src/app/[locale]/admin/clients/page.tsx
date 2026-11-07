import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole } from "@/lib/auth/guard";
import { countryLabel } from "@/lib/country";
import { PinIcon } from "@/components/ui/PortalIcons";

export default async function AdminClientsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, ["admin"]);
  const t = await getTranslations("admin.clients");
  const tb = await getTranslations("bookPage");
  const label = (v: string | null) => countryLabel(v, (k) => tb(k as never), t("notSpecified"));

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email, whatsapp, country, role, created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  // Where clients are from (accounts + call bookings without an account yet)
  const { data: bookings } = await supabase.from("call_bookings").select("email, country, client_id").limit(2000);
  const people = new Map<string, string | null>();
  for (const p of profiles ?? []) if (p.role === "client") people.set(p.email.toLowerCase(), p.country);
  for (const b of bookings ?? []) {
    const key = String(b.email ?? "").toLowerCase();
    if (key && !people.has(key)) people.set(key, b.country);
  }
  const counts = new Map<string, number>();
  for (const c of people.values()) {
    const name = label(c);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const byCountry = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const top = byCountry[0]?.[1] ?? 1;

  return (
    <div className="space-y-4">
      <h1 className="section-title text-2xl">{t("title")}</h1>
      <section className="card p-4 sm:p-5" data-testid="clients-by-country">
        <h2 className="flex items-center gap-2 text-base font-extrabold text-ink">
          <PinIcon size={18} className="text-forest" />
          {t("byCountry")}
        </h2>
        <p className="text-xs text-muted">{t("byCountryHint", { count: people.size })}</p>
        <ul className="mt-3 space-y-2">
          {byCountry.map(([name, n]) => (
            <li key={name} className="flex items-center gap-3 text-sm">
              <span className="w-36 shrink-0 truncate font-semibold text-ink sm:w-48">{name}</span>
              <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-offwhite">
                <span className="block h-full rounded-full bg-forest" style={{ width: `${Math.max(6, (n / top) * 100)}%` }} />
              </span>
              <span className="w-16 shrink-0 text-right text-xs font-bold text-muted">
                {n} · {Math.round((n / Math.max(1, people.size)) * 100)}%
              </span>
            </li>
          ))}
        </ul>
      </section>
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
                <td className="px-4 py-2.5 text-muted">{label(p.country)}</td>
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
