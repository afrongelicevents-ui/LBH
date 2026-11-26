import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guard";
import { formatCents } from "@/lib/money";
import { clean } from "@/lib/shops";
import { AssignOrder } from "@/components/shops/ShopAdmin";

/** Admin → Shop orders: new ones first; assign a project manager to buy. */
export default async function AdminShopOrdersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, ["admin"]);
  const t = await getTranslations("shops.admin");
  const ts = await getTranslations("shops.orders.status");
  const [{ data: orders }, { data: pms }] = await Promise.all([
    supabase
      .from("shop_orders")
      .select("id, code, status, total_cents, paid_cents, client_note, assigned_to, created_at, shops(name), profiles!shop_orders_client_id_fkey(full_name, email), shop_order_items(qty, name)")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("profiles").select("id, full_name, email").eq("role", "field").order("full_name"),
  ]);
  const list = orders ?? [];
  const order = ["placed", "changed", "assigned", "bought", "cancelled"];
  list.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
  const pmList = (pms ?? []).map((p) => ({ id: p.id, name: clean(p.full_name || p.email) }));
  return (
    <div className="mx-auto max-w-4xl space-y-4" data-testid="admin-shop-orders">
      <div>
        <Link href="/admin/shops" className="text-xs font-semibold text-muted hover:text-forest">← {t("back")}</Link>
        <h1 className="section-title mt-1 text-2xl">{t("ordersTitle")}</h1>
        <p className="mt-1 text-sm text-muted">{t("ordersIntro")}</p>
      </div>
      {list.length === 0 && <p className="card p-5 text-sm text-muted">{t("noOrders")}</p>}
      {list.map((o) => {
        const client = o.profiles as unknown as { full_name: string; email: string } | null;
        return (
          <section key={o.id} className="card space-y-2 p-5" data-testid="admin-shop-order" data-status={o.status}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-lg font-bold tracking-widest text-ink">{o.code}</span>
              <span className={`badge ${o.status === "placed" || o.status === "changed" ? "badge-prog" : o.status === "bought" ? "badge-done" : "badge-ok"}`}>{ts(o.status as never)}</span>
            </div>
            <p className="text-sm text-muted">
              {clean((o.shops as unknown as { name: string } | null)?.name ?? "")} · {t("client")}: {clean(client?.full_name || client?.email || "")} ·{" "}
              <strong className="text-ink">{formatCents(o.status === "bought" ? (o.paid_cents ?? o.total_cents) : o.total_cents)}</strong>
            </p>
            <p className="text-sm text-ink">{(o.shop_order_items ?? []).map((i) => `${i.qty} × ${clean(i.name)}`).join(", ")}</p>
            {o.client_note && <p className="text-sm text-ink">“{o.client_note}”</p>}
            {["placed", "assigned"].includes(o.status) && <AssignOrder orderId={o.id} current={o.assigned_to} pms={pmList} canCancel />}
          </section>
        );
      })}
    </div>
  );
}
