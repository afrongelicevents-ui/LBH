import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guard";
import { formatCents } from "@/lib/money";
import { clean } from "@/lib/shops";
import { ShopForm, ShopStatusButtons, ShopItemForm, ShopItemButtons } from "@/components/shops/ShopAdmin";

/** Admin → one shop: status, warnings, details and prices. */
export default async function AdminShopPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, ["admin"]);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const t = await getTranslations("shops.admin");
  const tc = await getTranslations("shops.cat");
  const [{ data: shop }, { data: contact }, { data: items }] = await Promise.all([
    supabase.from("shops").select("id, slug, name, area, address, about, categories, status, warnings, fair_price_agreed_at").eq("id", id).maybeSingle(),
    supabase.from("shop_contacts").select("contact_name, phone, email, notes").eq("shop_id", id).maybeSingle(),
    supabase.from("shop_items").select("id, name, category, unit, price_cents, in_stock").eq("shop_id", id).order("category").order("name"),
  ]);
  if (!shop) notFound();
  return (
    <div className="mx-auto max-w-4xl space-y-4" data-testid="admin-shop">
      <div>
        <Link href="/admin/shops" className="text-xs font-semibold text-muted hover:text-forest">← {t("back")}</Link>
        <h1 className="section-title mt-1 text-2xl">{clean(shop.name)}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
          <span className={`badge ${shop.status === "approved" ? "badge-done" : shop.status === "suspended" ? "badge-prog" : "badge-ok"}`} data-testid="admin-shop-status">{t(shop.status as never)}</span>
          <span>{t("warnings", { count: shop.warnings })} · {t("warnHint")}</span>
          {shop.status === "approved" && <Link href={`/shops/${shop.slug}`} className="font-semibold text-forest underline">{t("view")}</Link>}
        </p>
      </div>
      <section className="card p-5"><ShopStatusButtons id={shop.id} status={shop.status} warnings={shop.warnings} /></section>
      <section className="card p-5">
        <h2 className="mb-3 text-base font-extrabold text-ink">{t("items")}</h2>
        <ShopItemForm shopId={shop.id} />
        {!items?.length ? (
          <p className="mt-3 text-sm text-muted">{t("noItems")}</p>
        ) : (
          <ul className="mt-3 divide-y divide-[#eef0ef]">
            {items.map((i) => (
              <li key={i.id} className="py-3" data-testid="admin-shop-item">
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 text-sm">
                    <span><strong className="text-ink">{clean(i.name)}</strong><span className="text-muted"> · {tc(i.category as never)} · {i.unit}{i.in_stock ? "" : ` · ${t("inStock")}: ✗`}</span></span>
                    <span className="font-extrabold text-forest">{formatCents(i.price_cents)}</span>
                  </summary>
                  <div className="mt-3 space-y-2">
                    <ShopItemForm shopId={shop.id} item={i} />
                    <ShopItemButtons id={i.id} inStock={i.in_stock} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="card p-5">
        <h2 className="mb-3 text-base font-extrabold text-ink">{t("details")}</h2>
        <ShopForm shop={{ ...shop, contact_name: contact?.contact_name ?? "", phone: contact?.phone ?? "", email: contact?.email ?? "", notes: contact?.notes ?? "" }} />
      </section>
    </div>
  );
}
