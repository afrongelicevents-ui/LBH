import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import JoinShopForm from "@/components/shops/JoinShopForm";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "shops.joinPage" });
  return { title: t("metaTitle") };
}

/** Shops apply to be listed; an admin checks and approves them. */
export default async function JoinShopPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("shops");
  return (
    <div className="ds-wrap max-w-3xl py-10 md:py-14" data-testid="shop-join-page">
      <Link href="/shops" className="text-sm font-semibold text-slate hover:text-forest">← {t("back")}</Link>
      <h1 className="ds-h2 mt-3">{t("joinPage.title")}</h1>
      <p className="ds-lead mt-3">{t("joinPage.lead")}</p>
      <section className="card mt-6 p-5" aria-labelledby="rules">
        <h2 id="rules" className="ds-h3">{t("joinPage.rulesTitle")}</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-[15px] text-charcoal">
          {(["r1", "r2", "r3", "r4"] as const).map((k) => <li key={k}>{t(`joinPage.${k}`)}</li>)}
        </ol>
      </section>
      <JoinShopForm />
    </div>
  );
}
