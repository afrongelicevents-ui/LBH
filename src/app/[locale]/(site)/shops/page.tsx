import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { loadItems, loadShops, clean } from "@/lib/shops";
import { formatCents } from "@/lib/money";
import { SHOP_CATEGORIES } from "@/config/shops";
import { FairPromise, HowOrdering, JoinCta } from "@/components/shops/ShopBits";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "shops.meta" });
  return { title: t("title"), description: t("description") };
}

/** LBH Shops: compare materials across approved shops (cheapest first) and browse shops. */
export default async function ShopsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ c?: string; q?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const cat = (SHOP_CATEGORIES as readonly string[]).includes(sp.c ?? "") ? sp.c! : null;
  const q = (sp.q ?? "").slice(0, 60);
  const [shops, items] = await Promise.all([loadShops(), loadItems(cat, q)]);
  const t = await getTranslations("shops");
  const byId = new Map(shops.map((s) => [s.id, s]));
  const chip = (c: string | null) =>
    `rounded-full border px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap ${c === cat ? "border-forest bg-forest text-white" : "border-rule bg-paper text-charcoal hover:border-forest"}`;
  const href = (c: string | null) => ({ pathname: "/shops", query: { ...(c ? { c } : {}), ...(q ? { q } : {}) } });

  return (
    <div data-testid="shops-page">
      <header className="border-b border-rule">
        <div className="ds-wrap py-12 md:py-16">
          <p className="ds-eyebrow">{t("hero.eyebrow")}</p>
          <h1 className="ds-h2 mt-3 max-w-3xl md:text-[3rem]">{t("hero.title")}</h1>
          <p className="ds-lead mt-4 max-w-2xl">{t("hero.lead")}</p>
        </div>
      </header>

      <section className="ds-wrap py-8 md:py-12" aria-labelledby="compare">
        <h2 id="compare" className="ds-h3">{t("compare")}</h2>
        <p className="ds-body mt-1 text-slate">{t("compareIntro")}</p>
        <form action="" className="mt-4 flex max-w-xl gap-2" role="search">
          {cat && <input type="hidden" name="c" value={cat} />}
          <label className="sr-only" htmlFor="shop-q">{t("search")}</label>
          <input id="shop-q" name="q" defaultValue={q} placeholder={t("search")} className="w-full rounded-[10px] border border-rule bg-paper px-3 py-2.5 text-[15px]" data-testid="shops-search" />
          <button className="ds-btn ds-btn-primary shrink-0 px-5">{t("searchBtn")}</button>
        </form>
        <nav className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-2" aria-label={t("compare")}>
          <Link href={href(null)} className={chip(null)}>{t("all")}</Link>
          {SHOP_CATEGORIES.map((c) => (
            <Link key={c} href={href(c)} className={chip(c)} data-testid={`shops-cat-${c}`}>{t(`cat.${c}`)}</Link>
          ))}
        </nav>

        {shops.length === 0 ? (
          <p className="ds-lead mt-6 max-w-2xl" data-testid="shops-empty">{t("empty")}</p>
        ) : items.length === 0 ? (
          <p className="ds-body mt-6">{t("noItems")}</p>
        ) : (
          <ul className="mt-4 divide-y divide-rule border-y border-rule" data-testid="shops-compare">
            {items.map((i) => {
              const s = byId.get(i.shop_id);
              if (!s) return null;
              return (
                <li key={i.id} className="flex items-center justify-between gap-4 py-3.5" data-testid="compare-row">
                  <div className="min-w-0">
                    <p className="font-semibold text-charcoal">{clean(i.name)}</p>
                    <p className="text-sm text-slate">
                      {i.unit} · {t("at")}{" "}
                      <Link href={`/shops/${s.slug}`} className="ds-link">{clean(s.name)}</Link>
                      {s.area ? ` · ${s.area}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-serif text-lg font-bold text-charcoal">{formatCents(i.price_cents)}</p>
                    {!i.in_stock && <p className="text-xs font-semibold text-red-700">{t("outOfStock")}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {shops.length > 0 && (
        <section className="ds-wrap pb-10 md:pb-14" aria-labelledby="shops-list">
          <h2 id="shops-list" className="ds-h3">{t("shopsTitle")}</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shops.map((s) => (
              <li key={s.id}>
                <Link href={`/shops/${s.slug}`} className="card block h-full p-5 hover:border-forest" data-testid="shop-card">
                  <p className="font-serif text-xl font-bold text-charcoal">{clean(s.name)}</p>
                  {s.area && <p className="text-sm text-slate">{s.area}</p>}
                  <p className="mt-2 flex flex-wrap gap-1.5">
                    {s.fair_price_agreed_at && <span className="ds-tag ds-tag-green">✓ {t("fair")}</span>}
                    {s.categories.slice(0, 3).map((c) => (
                      <span key={c} className="ds-tag">{t(`cat.${c}` as never)}</span>
                    ))}
                  </p>
                  <span className="ds-link mt-3 inline-block text-sm">{t("view")} →</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="ds-wrap grid gap-4 pb-14 md:grid-cols-2">
        <FairPromise />
        <HowOrdering />
      </div>
      <JoinCta />
    </div>
  );
}
