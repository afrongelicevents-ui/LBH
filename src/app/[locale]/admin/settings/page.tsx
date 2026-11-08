import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole } from "@/lib/auth/guard";
import { Link } from "@/i18n/navigation";
import { CameraIcon, CardIcon, ChevronRightIcon, ListIcon } from "@/components/ui/PortalIcons";
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
      <h1 className="section-title text-2xl">{t("title")}</h1>
      <Link href="/admin/settings/photos" className="card flex items-center gap-3 p-4 hover:shadow-(--shadow-card-hover)" data-testid="website-photos-link">
        <span className="icon-round icon-forest h-11 w-11">
          <CameraIcon size={22} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-extrabold text-ink">{t("photosTitle")}</span>
          <span className="block text-xs text-muted">{t("photosHint")}</span>
        </span>
        <ChevronRightIcon size={18} className="text-muted" />
      </Link>
      <Link href="/admin/settings/build-account" className="card flex items-center gap-3 p-4 hover:shadow-(--shadow-card-hover)" data-testid="ba-settings-link">
        <span className="icon-round icon-forest h-11 w-11">
          <CardIcon size={22} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-extrabold text-ink">{t("baTitle")}</span>
          <span className="block text-xs text-muted">{t("baHint")}</span>
        </span>
        <ChevronRightIcon size={18} className="text-muted" />
      </Link>
      <Link href="/admin/settings/price-list" className="card flex items-center gap-3 p-4 hover:shadow-(--shadow-card-hover)" data-testid="price-list-link">
        <span className="icon-round icon-forest h-11 w-11">
          <ListIcon size={22} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-extrabold text-ink">{t("priceTitle")}</span>
          <span className="block text-xs text-muted">{t("priceHint")}</span>
        </span>
        <ChevronRightIcon size={18} className="text-muted" />
      </Link>
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
