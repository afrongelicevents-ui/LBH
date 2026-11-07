import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getUserProfile } from "@/lib/supabase/server";
import { homeForRole } from "@/lib/auth/roles";
import SignupForm from "@/components/auth/SignupForm";

export const metadata: Metadata = { title: "Create account" };

export default async function SignupPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { profile } = await getUserProfile();
  if (profile) {
    redirect({ href: homeForRole(profile.role), locale });
  }

  return (
    <div className="bg-offwhite px-4 py-10 md:py-16">
      <div className="mx-auto max-w-md">
        <SignupForm />
      </div>
    </div>
  );
}
