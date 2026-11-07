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
  const { profile } = await requireRole(locale, ["admin"]);
  const t = await getTranslations();

  return (
    <PortalShell
      locale={locale}
      profile={profile}
      areaKey="admin"
      nav={portalNavFor("admin").map((n) => ({ ...n, label: t(n.label as never) }))}
    >
      {children}
    </PortalShell>
  );
}
