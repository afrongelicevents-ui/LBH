import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guard";
import { cleanOfficeHours } from "@/lib/officeHours";
import { ReplySettingsForm } from "@/components/admin/InboxAdmin";

/** Reply promise, office hours ("Online now") and who gets alert emails. */
export default async function ReplySettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, ["admin"]);
  const t = await getTranslations("admin.inbox");
  const { data: s } = await supabase.from("settings").select("reply_hours, office_hours, office_tz, alert_emails").eq("id", 1).single();
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <Link href="/admin/settings" className="text-xs font-semibold text-muted hover:text-forest">← {t("backSettings")}</Link>
        <h1 className="section-title mt-1 text-2xl">{t("settingsTitle")}</h1>
        <p className="mt-1 text-sm text-muted">{t("settingsIntro")}</p>
      </div>
      <ReplySettingsForm
        replyHours={s?.reply_hours ?? 24}
        officeHours={cleanOfficeHours(s?.office_hours)}
        officeTz={s?.office_tz ?? "Africa/Harare"}
        alertEmails={(s?.alert_emails as string[] | null) ?? []}
      />
    </div>
  );
}
