import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guard";
import { clean } from "@/lib/shops";

/** Field: shop orders assigned to me (no client money details beyond the order itself). */
export default async function FieldShopOrdersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, ["field"]);
  const t = await getTranslations("shops.field");
  const ts = await getTranslations("shops.orders.status");
  const { data } = await supabase
    .from("shop_orders")
    .select("id, code, status, created_at, shops(name, area)")
    .in("status", ["assigned", "changed", "bought"])
    .order("updated_at", { ascending: false })
    .limit(50);
  const orders = data ?? [];
  return (
    <div className="mx-auto max-w-3xl space-y-4" data-testid="field-shop-orders">
      <div>
        <h1 className="section-title text-2xl">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("intro")}</p>
      </div>
      {orders.length === 0 ? (
        <p className="card p-5 text-sm text-muted">{t("none")}</p>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => {
            const s = o.shops as unknown as { name: string; area: string } | null;
            return (
              <li key={o.id}>
                <Link href={`/field/shop-orders/${o.id}`} className="card flex items-center justify-between gap-3 p-4 hover:border-forest" data-testid="field-shop-order">
                  <span>
                    <span className="block font-mono text-lg font-bold tracking-widest text-ink">{o.code}</span>
                    <span className="block text-sm text-muted">{clean(s?.name ?? "")}{s?.area ? ` · ${s.area}` : ""}</span>
                  </span>
                  <span className={`badge ${o.status === "assigned" ? "badge-prog" : o.status === "bought" ? "badge-done" : "badge-ok"}`}>{ts(o.status as never)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
