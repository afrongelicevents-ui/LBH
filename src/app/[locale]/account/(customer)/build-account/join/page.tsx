import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole } from "@/lib/auth/guard";
import { AcceptInviteButton } from "@/components/buildAccount/PlanButtons";
import { CardIcon } from "@/components/ui/PortalIcons";

/** Accept a family invite to someone's Build Account (signed-in client). */
export default async function JoinBuildAccount({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { locale } = await params;
  const { t: token } = await searchParams;
  setRequestLocale(locale);
  await requireRole(locale, ["client"]);
  const t = await getTranslations("ba");
  const valid = typeof token === "string" && /^[A-Za-z0-9_-]{20,100}$/.test(token);
  return (
    <div className="mx-auto max-w-md space-y-4" data-testid="ba-join">
      <h1 className="section-title text-2xl">
        <CardIcon size={22} className="text-forest" />
        {t("title")}
      </h1>
      <section className="card space-y-3 p-5">
        <p className="text-base font-extrabold text-ink">{t("join.title")}</p>
        <p className="text-sm text-muted">{t("join.text")}</p>
        {valid ? <AcceptInviteButton token={token!} /> : <p role="alert" className="text-sm font-bold text-red-700">{t("error.invite")}</p>}
      </section>
    </div>
  );
}
