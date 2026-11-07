import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getUserProfile } from "@/lib/supabase/server";
import { homeForRole } from "@/lib/auth/roles";
import LoginForm from "@/components/auth/LoginForm";
import { safeNextPath } from "@/lib/signup";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ confirm?: string; next?: string }>;
}) {
  const { locale } = await params;
  const { confirm, next } = await searchParams;
  const safeNext = next ? safeNextPath(next, "") : "";
  setRequestLocale(locale);

  const { profile } = await getUserProfile();
  if (profile) {
    // back to the page they were trying to open, if it belongs to their area
    const home = homeForRole(profile.role);
    const area = home.replace(/^\//, "");
    const ok = safeNext && new RegExp(`^(/(sn|nd))?/${area}(/|\\?|$)`).test(safeNext);
    redirect({ href: ok ? safeNext.replace(/^\/(sn|nd)(?=\/)/, "") : home, locale });
  }

  return (
    <div className="bg-offwhite px-4 py-10 md:py-16">
      <div className="mx-auto max-w-md">
        <LoginForm confirmFailed={confirm === "failed"} next={safeNext || null} />
      </div>
    </div>
  );
}
