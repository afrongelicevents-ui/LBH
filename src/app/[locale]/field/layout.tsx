import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole } from "@/lib/auth/guard";
import PortalShell from "@/components/portal/PortalShell";
import { portalNavFor } from "@/config/portalNav";
import OutboxProvider from "@/components/field/OutboxProvider";

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
  const t = await getTranslations();

  return (
    <PortalShell
      locale={locale}
      profile={profile}
      areaKey={profile.staff_kind === "lawyer" ? "lawyer" : "field"}
      nav={portalNavFor("field").map((n) => ({ ...n, label: t(n.label as never) }))}
    >
      <OutboxProvider userId={profile.id}>{children}</OutboxProvider>
    </PortalShell>
  );
}
