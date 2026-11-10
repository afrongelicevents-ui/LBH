import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { getUserProfile } from "@/lib/supabase/server";
import SectionTitle from "@/components/SectionTitle";

export const metadata: Metadata = { title: "Build Account invite", robots: { index: false } };

/** Family invite link: signed-in clients accept in the portal; others log in or create an account first. */
export default async function JoinInfo({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { locale } = await params;
  const { t: raw } = await searchParams;
  setRequestLocale(locale);
  const token = typeof raw === "string" && /^[A-Za-z0-9_-]{20,100}$/.test(raw) ? raw : "";
  const target = `/account/build-account/join?t=${token}`;
  const { profile } = await getUserProfile();
  if (profile?.role === "client" && token) redirect({ href: target, locale });
  const t = await getTranslations("baPublic");

  return (
    <div className="bg-offwhite px-4 py-12 md:py-16" data-testid="ba-join-info">
      <div className="mx-auto max-w-md">
        <SectionTitle as="h1">{t("joinTitle")}</SectionTitle>
        <div className="card mt-6 space-y-3 p-5">
          {!token ? (
            <p role="alert" className="text-sm font-bold text-red-700">{t("joinBad")}</p>
          ) : (
            <>
              <p className="text-sm text-ink">{t("joinText")}</p>
              <Link href={`/login?next=${encodeURIComponent(target)}`} className="btn btn-primary w-full" data-testid="ba-join-login">
                {t("login")}
              </Link>
              <Link href="/signup" className="btn btn-outline-green w-full">
                {t("createAccount")}
              </Link>
              <p className="text-xs text-muted">{t("joinNew")}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
