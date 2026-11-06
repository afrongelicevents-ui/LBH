import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole } from "@/lib/auth/guard";
import PortalShell from "@/components/portal/PortalShell";

export default async function FieldLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { profile } = await requireRole(locale, ["field"]);
  const t = await getTranslations("portal.nav");

  return (
    <PortalShell
      locale={locale}
      profile={profile}
      areaKey="field"
      nav={[{ href: "/field", label: t("myJobs") }]}
    >
      {children}
    </PortalShell>
  );
}
