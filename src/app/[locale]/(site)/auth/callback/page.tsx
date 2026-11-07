import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import AuthCallback from "@/components/auth/AuthCallback";

export const metadata: Metadata = { title: "Confirming your email", robots: { index: false } };

/** Landing page of Supabase's standard "confirm your email" link. */
export default async function AuthCallbackPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <div className="bg-offwhite px-4 py-10 md:py-16">
      <div className="mx-auto max-w-md">
        <AuthCallback />
      </div>
    </div>
  );
}
