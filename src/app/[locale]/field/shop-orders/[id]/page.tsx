import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guard";
import { clean } from "@/lib/shops";
import FieldOrderForm from "@/components/shops/FieldOrderForm";

/** Field: one shop order — the code to show, the shop, and the buy / report form. */
export default async function FieldShopOrderPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, ["field"]);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const t = await getTranslations("shops.field");
  const { data: o } = await supabase
    .from("shop_orders")
    .select("id, code, status, client_note, bought_at, shop_id, shops(name, area, address), shop_order_items(id, name, unit, qty, price_cents)")
    .eq("id", id)
    .maybeSingle();
  if (!o) notFound();
  const shop = o.shops as unknown as { name: string; area: string; address: string } | null;
  const { data: contact } = await supabase.from("shop_contacts").select("contact_name, phone").eq("shop_id", o.shop_id).maybeSingle();

  return (
    <div className="mx-auto max-w-3xl space-y-4" data-testid="field-shop-order-page">
      <Link href="/field/shop-orders" className="text-xs font-semibold text-muted hover:text-forest">← {t("title")}</Link>
      <section className="card p-5 text-center">
        <p className="text-xs font-semibold tracking-wider text-muted uppercase">{t("codeLabel")}</p>
        <p className="mt-1 font-mono text-4xl font-bold tracking-[0.2em] text-ink" data-testid="field-order-code">{o.code}</p>
      </section>
      <section className="card p-5 text-sm">
        <p className="font-semibold text-ink">{t("shop")}: {clean(shop?.name ?? "")}</p>
        <p className="text-muted">{[shop?.area, clean(shop?.address ?? "")].filter(Boolean).join(" · ")}</p>
        {contact && (contact.contact_name || contact.phone) && (
          <p className="mt-1 text-muted">
            {t("contact")}: {clean(contact.contact_name)}{" "}
            {contact.phone && <a href={`tel:${contact.phone.replace(/\s/g, "")}`} className="font-semibold text-forest underline">{contact.phone}</a>}
          </p>
        )}
        {o.client_note && <p className="mt-2 text-ink">“{o.client_note}”</p>}
      </section>
      {o.status === "assigned" ? (
        <FieldOrderForm orderId={o.id} items={(o.shop_order_items ?? []).map((i) => ({ ...i, name: clean(i.name) }))} />
      ) : (
        <p className="card p-5 text-sm font-semibold text-ink">
          {o.status === "changed" ? t("waiting") : o.bought_at ? t("done", { date: new Date(o.bought_at).toLocaleDateString("en-GB") }) : ""}
        </p>
      )}
    </div>
  );
}
