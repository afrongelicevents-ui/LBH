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
        { href: "/admin", label: t("needsYou"), icon: "home" },
        { href: "/admin/requests", label: t("requests"), icon: "doc" },
        { href: "/admin/builds", label: t("builds"), icon: "hammer" },
        { href: "/admin/bookings", label: t("bookings"), icon: "calendar" },
        { href: "/admin/clients", label: t("clients"), icon: "users" },
        { href: "/admin/chats", label: t("chats"), icon: "chat" },
        { href: "/admin/payments", label: t("payments"), icon: "card" },
        { href: "/admin/interest", label: t("interest"), icon: "bell" },
        { href: "/admin/settings", label: t("settings"), icon: "cog" },
        { href: "/admin/translations", label: t("translations"), icon: "globe" },
        { href: "/admin/audit", label: t("audit"), icon: "list" },
      ]}
    >
      {children}
    </PortalShell>
  );
}
