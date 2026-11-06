import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import PasswordForm from "@/components/auth/PasswordForm";

export const metadata: Metadata = { title: "Set password" };

export default async function PasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <div className="bg-offwhite px-4 py-10 md:py-16">
      <div className="mx-auto max-w-md">
        <PasswordForm />
      </div>
    </div>
  );
}
