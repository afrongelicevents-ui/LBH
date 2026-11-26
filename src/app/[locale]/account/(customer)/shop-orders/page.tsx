import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guard";
import { formatCents } from "@/lib/money";
import { signedUrl } from "@/lib/uploads";
import { clean } from "@/lib/shops";
import PageHead from "@/components/account/PageHead";
import { ClientOrderActions } from "@/components/shops/ShopOrderActions";

const TAG: Record<string, string> = { changed: "ds-tag-alert", bought: "ds-tag-green" };

/** The client's shop orders: code, status, what changed, receipt. */
export default async function ShopOrdersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, ["client"]);
  const t = await getTranslations("shops.orders");
  const tn = await getTranslations("site.account");
  const { data } = await supabase
    .from("shop_orders")
    .select("id, code, status, total_cents, paid_cents, client_note, field_note, receipt_path, created_at, shops(name, slug), shop_order_items(id, name, unit, qty, price_cents, shelf_price_cents, available)")
    .order("created_at", { ascending: false })
    .limit(50);
  const orders = data ?? [];
  const receipts = new Map<string, string | null>();
  await Promise.all(orders.filter((o) => o.receipt_path).map(async (o) => receipts.set(o.id, await signedUrl("documents", o.receipt_path!, 600))));
  const fmt = (s: string) => new Date(s).toLocaleDateString(locale === "en" ? "en-GB" : locale, { day: "numeric", month: "short", year: "numeric" });

  return (
    <div data-testid="shop-orders-page">
      <PageHead eyebrow={tn("shopOrders")} title={t("title")} intro={t("intro")} />
      {orders.length === 0 ? (
        <div className="mt-8">
          <p className="ds-body">{t("none")}</p>
          <Link href="/shops" className="ds-btn ds-btn-primary mt-4">{t("browse")}</Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {orders.map((o) => {
            const shop = o.shops as unknown as { name: string; slug: string } | null;
            const items = o.shop_order_items ?? [];
            const changed = items.filter((i) => !i.available || (i.shelf_price_cents && i.shelf_price_cents !== i.price_cents));
            return (
              <li key={o.id} className="card p-5" data-testid="shop-order" data-status={o.status}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold tracking-wider text-slate uppercase">{t("code")}</p>
                    <p className="font-mono text-2xl font-bold tracking-widest text-charcoal" data-testid="shop-order-code">{o.code}</p>
                    <p className="text-sm text-slate">
                      {clean(shop?.name ?? "")} · {t("placedOn", { date: fmt(o.created_at) })}
                    </p>
                  </div>
                  <span className={`ds-tag ${TAG[o.status] ?? ""}`}>{t(`status.${o.status}` as never)}</span>
                </div>
                <ul className="mt-4 space-y-1.5 border-t border-rule pt-3 text-sm">
                  {items.map((i) => (
                    <li key={i.id} className="flex justify-between gap-3">
                      <span className={i.available ? "text-charcoal" : "text-slate line-through"}>{i.qty} × {clean(i.name)} <span className="text-slate">({i.unit})</span></span>
                      <span className="shrink-0 font-semibold">{formatCents(i.qty * i.price_cents)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 flex justify-between border-t border-rule pt-3 font-semibold">
                  <span>{o.status === "bought" ? t("paid") : t("total")}</span>
                  <span>{formatCents(o.status === "bought" ? (o.paid_cents ?? o.total_cents) : o.total_cents)}</span>
                </p>
                {o.status === "changed" && (
                  <div className="mt-4 rounded-[10px] border border-rule bg-paper p-4" data-testid="shop-order-changes">
                    <p className="font-semibold text-charcoal">{t("changes")}</p>
                    <ul className="mt-2 space-y-1 text-sm">
                      {changed.map((i) => (
                        <li key={i.id}>
                          {clean(i.name)}: {!i.available ? t("missing") : t("newPrice", { price: formatCents(i.shelf_price_cents!), old: formatCents(i.price_cents) })}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {o.field_note && <p className="mt-3 text-sm text-charcoal"><strong>{t("pmNote")}:</strong> {o.field_note}</p>}
                {receipts.get(o.id) && (
                  <a href={receipts.get(o.id)!} target="_blank" rel="noreferrer" className="ds-link mt-3 inline-block text-sm" data-testid="shop-order-receipt">{t("receipt")} →</a>
                )}
                <ClientOrderActions id={o.id} status={o.status} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
