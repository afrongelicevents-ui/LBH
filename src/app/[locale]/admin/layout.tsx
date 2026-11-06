import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole } from "@/lib/auth/guard";
import PortalShell from "@/components/portal/PortalShell";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { profile } = await requireRole(locale, ["admin"]);
  const t = await getTranslations("admin.nav");

  return (
    <PortalShell
      locale={locale}
      profile={profile}
      areaKey="admin"
      nav={[
        { href: "/admin", label: t("needsYou") },
        { href: "/admin/requests", label: t("requests") },
        { href: "/admin/bookings", label: t("bookings") },
        { href: "/admin/clients", label: t("clients") },
        { href: "/admin/chats", label: t("chats") },
        { href: "/admin/payments", label: t("payments") },
        { href: "/admin/interest", label: t("interest") },
        { href: "/admin/settings", label: t("settings") },
        { href: "/admin/translations", label: t("translations") },
        { href: "/admin/audit", label: t("audit") },
      ]}
    >
      {children}
    </PortalShell>
  );
}
