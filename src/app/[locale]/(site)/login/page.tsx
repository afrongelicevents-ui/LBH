import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getUserProfile } from "@/lib/supabase/server";
import { homeForRole } from "@/lib/auth/roles";
import LoginForm from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ confirm?: string }>;
}) {
  const { locale } = await params;
  const { confirm } = await searchParams;
  setRequestLocale(locale);

  const { profile } = await getUserProfile();
  if (profile) {
    redirect({ href: homeForRole(profile.role), locale });
  }

  return (
    <div className="bg-offwhite px-4 py-10 md:py-16">
      <div className="mx-auto max-w-md">
        <LoginForm confirmFailed={confirm === "failed"} />
      </div>
    </div>
  );
}
