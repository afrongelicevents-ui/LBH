import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getUserProfile } from "@/lib/supabase/server";
import MfaSetup from "@/components/auth/MfaSetup";

export const metadata: Metadata = { title: "Two-factor authentication" };

export default async function MfaPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { profile } = await getUserProfile();
  if (!profile) redirect({ href: "/login", locale });

  return (
    <div className="bg-offwhite px-4 py-10 md:py-16">
      <div className="mx-auto max-w-md">
        <MfaSetup />
      </div>
    </div>
  );
}
