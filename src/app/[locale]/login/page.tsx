import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import SectionTitle from "@/components/SectionTitle";
import { LockIcon, ArrowRightIcon } from "@/components/icons";

export const metadata: Metadata = { title: "Log in" };

/**
 * Placeholder until the client portal ships (Phase 3): real auth arrives
 * with Supabase Auth + email verification + 2FA for staff (brief §11).
 */
function LoginContent() {
  const t = useTranslations();
  return (
    <div className="bg-offwhite py-16 md:py-24">
      <div className="mx-auto max-w-xl px-4 text-center sm:px-6">
        <SectionTitle as="h1">{t("common.login")}</SectionTitle>
        <div className="card mt-10 flex flex-col items-center gap-4 p-10">
          <LockIcon width={40} height={40} className="text-gold" />
          <p className="text-base font-semibold text-forest">
            {t("common.comingSoon")}
          </p>
          <p className="text-sm text-muted">{t("servicesPage.notifyHint")}</p>
          <Link href="/book-a-call" className="btn btn-gold mt-2">
            {t("common.bookFirstCall")}
            <ArrowRightIcon width={18} height={18} />
          </Link>
        </div>
      </div>
    </div>
  );
}

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LoginContent />;
}
