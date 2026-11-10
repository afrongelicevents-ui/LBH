import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { getUserProfile } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCents } from "@/lib/money";
import SectionTitle from "@/components/SectionTitle";
import { ArrowRightIcon, CheckCircleIcon, ReceiptIcon, ShieldCheckIcon } from "@/components/icons";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "baPublic" });
  return { title: t("metaTitle") };
}

/** LBH Build Account — what it is (logged out); logged-in clients go straight to the app. */
export default async function BuildAccountInfo({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { profile } = await getUserProfile();
  if (profile?.role === "client") redirect({ href: "/account/build-account", locale });

  const t = await getTranslations("baPublic");
  const { data: s } = await createAdminClient()
    .from("settings")
    .select("build_account_enabled, build_account_monthly_cents, build_account_yearly_cents")
    .eq("id", 1)
    .single();
  const steps = [1, 2, 3, 4] as const;
  const features = ["f1", "f2", "f3", "f4", "f5", "f6"] as const;

  return (
    <div className="bg-offwhite py-12 md:py-16" data-testid="ba-info">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="flex justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-forest text-white">
            <ReceiptIcon width={28} height={28} />
          </span>
        </div>
        <SectionTitle as="h1">{t("title")}</SectionTitle>
        <p className="mt-4 text-center text-base text-muted md:text-lg">{t("intro")}</p>

        <section className="card mt-8 p-5 md:p-6">
          <h2 className="text-lg font-bold text-forest">{t("whatTitle")}</h2>
          <ul className="mt-3 space-y-2">
            {features.map((f) => (
              <li key={f} className="flex gap-2 text-sm text-ink md:text-base">
                <CheckCircleIcon width={20} height={20} className="mt-0.5 shrink-0 text-forest" />
                {t(f)}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-6">
          <h2 className="text-lg font-bold text-forest">{t("howTitle")}</h2>
          <ol className="mt-3 grid gap-3 sm:grid-cols-2">
            {steps.map((n) => (
              <li key={n} className="card flex gap-3 p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forest font-extrabold text-white">{n}</span>
                <p className="text-sm text-ink">{t(`step${n}`)}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-6" data-testid="ba-info-plans">
          <h2 className="text-lg font-bold text-forest">{t("plansTitle")}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="card p-5">
              <p className="font-bold text-ink">{t("planFreeTitle")}</p>
              <p className="mt-1 text-2xl font-extrabold text-forest">{t("free")}</p>
              <p className="mt-1 text-sm text-muted">{t("planFreeText")}</p>
            </div>
            {s?.build_account_enabled !== false && s?.build_account_monthly_cents ? (
              <div className="card p-5">
                <p className="font-bold text-ink">{t("planPaidTitle")}</p>
                <p className="mt-1 text-2xl font-extrabold text-forest">{t("perMonth", { amount: formatCents(s.build_account_monthly_cents) })}</p>
                {s.build_account_yearly_cents ? (
                  <p className="text-sm font-semibold text-ink">{t("orPerYear", { amount: formatCents(s.build_account_yearly_cents) })}</p>
                ) : null}
                <p className="mt-1 text-sm text-muted">{t("planPaidText")}</p>
              </div>
            ) : null}
          </div>
        </section>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {profile ? (
            <Link href="/" className="btn btn-primary px-7">
              {t("staffNote")}
            </Link>
          ) : (
            <>
              <Link href="/signup" className="btn btn-primary px-7" data-testid="ba-info-signup">
                {t("createAccount")}
                <ArrowRightIcon width={20} height={20} />
              </Link>
              <Link href="/login?next=/account/build-account" className="btn btn-outline-green px-7" data-testid="ba-info-login">
                {t("login")}
              </Link>
            </>
          )}
        </div>

        <div className="mt-8 flex items-start gap-3 rounded-2xl bg-info p-5">
          <ShieldCheckIcon width={26} height={26} className="mt-0.5 shrink-0 text-forest" />
          <p className="text-sm leading-relaxed text-ink md:text-base">{t("notABank")}</p>
        </div>
      </div>
    </div>
  );
}
