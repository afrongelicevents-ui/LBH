import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole } from "@/lib/auth/guard";
import PortalShell from "@/components/portal/PortalShell";
import { portalNavFor } from "@/config/portalNav";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { profile, supabase, user } = await requireRole(locale, ["admin"]);
  const t = await getTranslations();
  // new bookings / chat messages this admin hasn't seen yet
  const { count } = await supabase
    .from("admin_alerts")
    .select("id", { count: "exact", head: true })
    .not("seen_by", "cs", `{${user.id}}`);

  return (
    <PortalShell
      locale={locale}
      profile={profile}
      areaKey="admin"
      nav={portalNavFor("admin").map((n) => ({ ...n, label: t(n.label as never), badge: n.href === "/admin/inbox" ? count ?? 0 : undefined }))}
    >
      {children}
    </PortalShell>
  );
}
