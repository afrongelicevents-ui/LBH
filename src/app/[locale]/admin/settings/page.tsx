import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole } from "@/lib/auth/guard";
import { SettingsForm, InviteStaffForm } from "@/components/admin/AdminActions";

export default async function AdminSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, ["admin"]);
  const t = await getTranslations("admin.settings");

  const { data: settings } = await supabase.from("settings").select("*").eq("id", 1).single();

  return (
    <div className="space-y-6">
      <h1 className="headline text-2xl text-forest">{t("title")}</h1>
      {settings && (
        <SettingsForm
          settings={{
            per_km_rate_cents: settings.per_km_rate_cents,
            deposit_pct: settings.deposit_pct,
            whatsapp_number: settings.whatsapp_number,
            contact_email: settings.contact_email,
            call_slots: (settings.call_slots ?? []) as { id: string; label: string }[],
            banned_words: settings.banned_words ?? [],
          }}
        />
      )}
      <InviteStaffForm />
    </div>
  );
}
