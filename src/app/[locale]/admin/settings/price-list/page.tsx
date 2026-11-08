import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guard";
import { formatCents } from "@/lib/money";
import { PriceItemForm, DeletePriceButton } from "@/components/admin/BaAdmin";

/** Admin → Settings → Price list: usual prices that Build Account receipts are checked against. */
export default async function PriceListPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, ["admin"]);
  const t = await getTranslations("admin.ba");
  const { data: items } = await supabase.from("price_list").select("id, item, unit, area, price_cents").order("item");

  return (
    <div className="mx-auto max-w-4xl space-y-4" data-testid="admin-price-list">
      <div>
        <Link href="/admin/settings" className="text-xs font-semibold text-muted hover:text-forest">
          ← {t("backToSettings")}
        </Link>
        <h1 className="section-title mt-1 text-2xl">{t("priceTitle")}</h1>
        <p className="mt-1 text-sm text-muted">{t("priceIntro")}</p>
      </div>
      <section className="card p-5">
        <h2 className="mb-3 text-base font-extrabold text-ink">{t("addItem")}</h2>
        <PriceItemForm />
      </section>
      <section className="card p-5">
        <h2 className="text-base font-extrabold text-ink">{t("items", { count: items?.length ?? 0 })}</h2>
        {!items?.length ? (
          <p className="mt-2 text-sm text-muted">{t("noItems")}</p>
        ) : (
          <ul className="mt-2 divide-y divide-[#eef0ef]">
            {items.map((i) => (
              <li key={i.id} className="py-3" data-testid="price-row">
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 text-sm">
                    <span>
                      <strong className="text-ink">{i.item.replace(/^SAMPLE\s+/, "")}</strong>
                      <span className="text-muted"> · {i.unit} · {i.area}</span>
                    </span>
                    <span className="font-extrabold text-forest">{formatCents(i.price_cents)}</span>
                  </summary>
                  <div className="mt-3 space-y-2">
                    <PriceItemForm item={i} />
                    <DeletePriceButton id={i.id} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
