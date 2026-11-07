import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole } from "@/lib/auth/guard";
import PortalShell from "@/components/portal/PortalShell";

export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { profile } = await requireRole(locale, ["client"]);
  const t = await getTranslations("portal.nav");

  return (
    <PortalShell
      locale={locale}
      profile={profile}
      areaKey="client"
      nav={[
        { href: "/portal", label: t("dashboard") },
        { href: "/portal/build", label: t("myBuild") },
        { href: "/portal/requests/new-land", label: t("newLand") },
        { href: "/portal/requests/new-materials", label: t("newMaterials") },
        { href: "/portal/chat", label: t("chat") },
      ]}
    >
      {children}
    </PortalShell>
  );
}
