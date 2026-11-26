import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guard";
import { clean } from "@/lib/shops";
import { ShopForm } from "@/components/shops/ShopAdmin";

/** Admin → Shops: waiting / live / suspended, and add a shop. */
export default async function AdminShopsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, ["admin"]);
  const t = await getTranslations("shops.admin");
  const tn = await getTranslations("admin.nav");
  const { data } = await supabase.from("shops").select("id, name, area, status, warnings, fair_price_agreed_at, shop_items(count)").order("name");
  const shops = data ?? [];
  const groups = (["pending", "approved", "suspended"] as const).map((s) => ({ s, list: shops.filter((x) => x.status === s) }));
  return (
    <div className="mx-auto max-w-4xl space-y-4" data-testid="admin-shops">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="section-title text-2xl">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted">{t("intro")}</p>
        </div>
        <Link href="/admin/shops/orders" className="btn btn-outline-green min-h-10">{tn("shopOrders")} →</Link>
      </div>
      {groups.map(({ s, list }) => (
        <section key={s} className="card p-5" data-testid={`admin-shops-${s}`}>
          <h2 className="text-base font-extrabold text-ink">{t(s)} ({list.length})</h2>
          {list.length === 0 ? (
            <p className="mt-2 text-sm text-muted">{t("none")}</p>
          ) : (
            <ul className="mt-2 divide-y divide-[#eef0ef]">
              {list.map((x) => (
                <li key={x.id}>
                  <Link href={`/admin/shops/${x.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm hover:text-forest" data-testid="admin-shop-row">
                    <span>
                      <strong className="text-ink">{clean(x.name)}</strong>
                      <span className="text-muted"> · {x.area} · {(x.shop_items as unknown as { count: number }[])?.[0]?.count ?? 0} items</span>
                    </span>
                    <span className="flex gap-2">
                      {!x.fair_price_agreed_at && <span className="badge badge-ok">⚠ {t("errors.agreement")}</span>}
                      {x.warnings > 0 && <span className="badge badge-prog">{t("warnings", { count: x.warnings })}</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
      <section className="card p-5">
        <h2 className="mb-3 text-base font-extrabold text-ink">{t("add")}</h2>
        <ShopForm />
      </section>
    </div>
  );
}
