import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { loadShop, clean } from "@/lib/shops";
import ShopOrderBuilder from "@/components/shops/ShopOrderBuilder";
import { FairPromise } from "@/components/shops/ShopBits";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const d = await loadShop(slug);
  return { title: d ? `${clean(d.shop.name)} — LBH Shops` : "LBH Shops" };
}

/** One shop: its items and prices; clients build an order here. */
export default async function ShopPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const d = await loadShop(slug);
  if (!d) notFound();
  const t = await getTranslations("shops");
  const { shop, items } = d;
  return (
    <div data-testid="shop-page">
      <header className="border-b border-rule">
        <div className="ds-wrap py-10 md:py-14">
          <Link href="/shops" className="text-sm font-semibold text-slate hover:text-forest">← {t("back")}</Link>
          <h1 className="ds-h2 mt-3">{clean(shop.name)}</h1>
          {shop.area && <p className="ds-lead mt-1">{shop.area}</p>}
          <p className="mt-3 flex flex-wrap gap-1.5">
            {shop.fair_price_agreed_at && <span className="ds-tag ds-tag-green" data-testid="shop-fair">✓ {t("fair")}</span>}
            <span className="ds-tag">{t("items", { count: items.length })}</span>
          </p>
          {shop.about && <p className="ds-body mt-4 max-w-2xl">{clean(shop.about)}</p>}
        </div>
      </header>
      <ShopOrderBuilder
        shop={{ id: shop.id, name: clean(shop.name) }}
        items={items.map((i) => ({ id: i.id, name: clean(i.name), category: i.category, unit: i.unit, price_cents: i.price_cents, in_stock: i.in_stock, updated_at: i.updated_at }))}
      />
      <div className="ds-wrap pb-14">
        <FairPromise />
      </div>
    </div>
  );
}
