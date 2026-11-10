import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { getUserProfile } from "@/lib/supabase/server";
import { homeForRole, requiresMfa } from "@/lib/auth/roles";
import { areaFor } from "@/config/portalNav";
import ProfileForm from "@/components/auth/ProfileForm";

export const metadata: Metadata = { title: "My profile", robots: { index: false } };

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { profile, aal } = await getUserProfile();
  if (!profile) {
    redirect({ href: "/login", locale });
    return null;
  }
  if (requiresMfa(profile.role) && aal !== "aal2") {
    redirect({ href: "/mfa", locale });
    return null;
  }
  const t = await getTranslations("account");
  const area = areaFor(profile.role, profile.staff_kind);

  return (
    <div className="bg-offwhite px-4 py-10 md:py-16">
      <div className="mx-auto max-w-md space-y-4">
        <div className="card p-6 md:p-8">
          <h1 className="text-xl font-bold text-forest">{t("myProfile")}</h1>
          <p className="mt-1 text-xs text-muted">
            {t(`role.${area}` as never)} · {profile.email}
          </p>
          <div className="mt-5">
            <ProfileForm
              defaults={{
                full_name: profile.full_name,
                whatsapp: profile.whatsapp ?? "",
                country: profile.country ?? "",
              }}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href={homeForRole(profile.role)} className="btn btn-green text-sm">
            {t("openMyPortal")}
          </Link>
          <Link href="/account/password" className="btn btn-outline-green text-sm">
            {t("changePassword")}
          </Link>
        </div>
      </div>
    </div>
  );
}
