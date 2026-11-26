"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { useAuthProfile } from "@/components/auth/useAuthProfile";
import { placeShopOrder } from "@/app/actions/shops";
import { formatCents } from "@/lib/money";
import { SHOP_CATEGORIES, SHOP_ORDER_MAX_LINES } from "@/config/shops";

type Item = { id: string; name: string; category: string; unit: string; price_cents: number; in_stock: boolean; updated_at: string };
type Cart = { shopId: string; shopName: string; lines: Record<string, number> };

const KEY = "lbh-shop-cart";
function readCart(): Cart | null {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return c && typeof c.shopId === "string" && c.lines && typeof c.lines === "object" ? c : null;
  } catch {
    return null;
  }
}
function writeCart(c: Cart | null) {
  try {
    if (c && Object.keys(c.lines).length) localStorage.setItem(KEY, JSON.stringify(c));
    else localStorage.removeItem(KEY);
  } catch {
    // private mode: the order lives in this page only
  }
}

/** A shop's price list with an order builder (one shop per order; prices are locked by the server). */
export default function ShopOrderBuilder({ shop, items }: { shop: { id: string; name: string }; items: Item[] }) {
  const t = useTranslations("shops");
  const tc = useTranslations("shops.cart");
  const locale = useLocale();
  const auth = useAuthProfile();
  const pathname = usePathname();
  const [cart, setCart] = useState<Cart | null>(null);
  const [note, setNote] = useState("");
  const [result, setResult] = useState<{ code: string } | { error: string } | null>(null);
  const [busy, start] = useTransition();

  useEffect(() => {
    // localStorage is only readable after the first render in the browser
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCart(readCart());
  }, []);

  const mine = cart?.shopId === shop.id ? cart.lines : {};
  const otherShop = cart && cart.shopId !== shop.id && Object.keys(cart.lines).length ? cart.shopName : null;
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const lines = Object.entries(mine).filter(([id, q]) => byId.get(id)?.in_stock && q > 0);
  const total = lines.reduce((s, [id, q]) => s + (byId.get(id)?.price_cents ?? 0) * q, 0);

  const setQty = (id: string, q: number) => {
    const base: Cart = cart?.shopId === shop.id ? cart : { shopId: shop.id, shopName: shop.name, lines: {} };
    const next = { ...base, lines: { ...base.lines } };
    if (q <= 0) delete next.lines[id];
    else if (Object.keys(next.lines).length < SHOP_ORDER_MAX_LINES || next.lines[id]) next.lines[id] = Math.min(q, 100000);
    setCart(next);
    writeCart(next);
    setResult(null);
  };

  const send = () =>
    start(async () => {
      const r = await placeShopOrder({ shopId: shop.id, note, lines: lines.map(([itemId, qty]) => ({ itemId, qty })) }).catch(() => null);
      if (r?.ok && r.code) {
        setCart(null);
        writeCart(null);
        setNote("");
        setResult({ code: r.code });
      } else setResult({ error: r && !r.ok ? r.error : "error" });
    });

  const fmtDate = (s: string) => new Date(s).toLocaleDateString(locale === "en" ? "en-GB" : locale, { day: "numeric", month: "short" });
  const groups = SHOP_CATEGORIES.map((c) => ({ c, list: items.filter((i) => i.category === c) })).filter((g) => g.list.length);

  return (
    <div className="ds-wrap grid gap-8 py-8 md:py-12 lg:grid-cols-[1fr_360px] lg:items-start">
      <div>
        {otherShop && <p className="mb-4 rounded-[10px] border border-rule bg-paper px-4 py-3 text-sm text-charcoal" data-testid="cart-other-shop">{tc("otherShop")}</p>}
        {groups.length === 0 && <p className="ds-body">{t("noItems")}</p>}
        {groups.map(({ c, list }) => (
          <section key={c} className="mb-8" aria-labelledby={`cat-${c}`}>
            <h2 id={`cat-${c}`} className="ds-h3">{t(`cat.${c}` as never)}</h2>
            <ul className="mt-2 divide-y divide-rule border-y border-rule">
              {list.map((i) => {
                const q = mine[i.id] ?? 0;
                return (
                  <li key={i.id} className="flex items-center justify-between gap-3 py-3" data-testid="shop-item">
                    <div className="min-w-0">
                      <p className="font-semibold text-charcoal">{i.name}</p>
                      <p className="text-sm text-slate">
                        {i.unit} · {t("updated", { date: fmtDate(i.updated_at) })}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="font-serif text-lg font-bold text-charcoal">{formatCents(i.price_cents)}</span>
                      {!i.in_stock ? (
                        <span className="text-xs font-semibold text-red-700">{t("outOfStock")}</span>
                      ) : q === 0 ? (
                        <button type="button" onClick={() => setQty(i.id, 1)} className="ds-btn ds-btn-outline min-h-10 px-4 text-sm" data-testid="item-add">
                          + {tc("add")}
                        </button>
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-forest" data-testid="item-qty">
                          <button type="button" onClick={() => setQty(i.id, q - 1)} className="h-10 w-10 text-lg font-bold text-forest" aria-label={tc("less")}>−</button>
                          <input
                            value={q}
                            onChange={(e) => setQty(i.id, Math.max(0, parseInt(e.target.value.replace(/\D/g, "") || "0", 10)))}
                            inputMode="numeric"
                            aria-label={`${i.name}: ${i.unit}`}
                            className="w-12 bg-transparent text-center font-semibold"
                          />
                          <button type="button" onClick={() => setQty(i.id, q + 1)} className="h-10 w-10 text-lg font-bold text-forest" aria-label={tc("more")}>+</button>
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <aside className="card p-5 lg:sticky lg:top-24" aria-labelledby="cart-title" data-testid="shop-cart">
        <h2 id="cart-title" className="ds-h3">{tc("title")}</h2>
        {result && "code" in result ? (
          <div className="mt-3" role="status" data-testid="order-sent">
            <p className="font-semibold text-forest">{tc("sent")}</p>
            <p className="mt-1 text-sm text-charcoal">{tc("sentText", { code: result.code })}</p>
            <p className="mt-3 rounded-[10px] bg-paper px-4 py-3 text-center font-mono text-2xl font-bold tracking-widest text-charcoal" data-testid="order-code">{result.code}</p>
            <Link href="/account/shop-orders" className="ds-btn ds-btn-primary mt-4 w-full">{tc("see")}</Link>
          </div>
        ) : lines.length === 0 ? (
          <p className="mt-2 text-sm text-slate">{tc("empty")}</p>
        ) : (
          <>
            <ul className="mt-3 space-y-2 text-sm">
              {lines.map(([id, q]) => {
                const i = byId.get(id)!;
                return (
                  <li key={id} className="flex justify-between gap-3">
                    <span className="text-charcoal">{q} × {i.name}</span>
                    <span className="shrink-0 font-semibold">{formatCents(i.price_cents * q)}</span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 flex justify-between border-t border-rule pt-3 font-semibold">
              <span>{tc("total")}</span>
              <span data-testid="cart-total">{formatCents(total)}</span>
            </p>
            <label className="mt-4 block text-sm font-semibold text-charcoal">
              {tc("note")}
              <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} placeholder={tc("notePh")} className="mt-1 w-full rounded-[10px] border border-rule bg-paper px-3 py-2 text-[15px] font-normal" />
            </label>
            {auth.status === "in" && auth.profile.role === "client" ? (
              <button type="button" onClick={send} disabled={busy} className="ds-btn ds-btn-primary mt-4 w-full disabled:opacity-60" data-testid="order-send">
                {busy ? tc("sending") : tc("send")}
              </button>
            ) : auth.status === "out" ? (
              <div className="mt-4 grid gap-2">
                <Link href={{ pathname: "/login", query: { next: pathname } }} className="ds-btn ds-btn-primary w-full" data-testid="order-login">{tc("login")}</Link>
                <Link href="/signup" className="ds-btn ds-btn-outline w-full">{tc("signup")}</Link>
              </div>
            ) : auth.status === "in" ? (
              <p className="mt-4 text-sm text-slate">{tc("errors.role")}</p>
            ) : null}
            {result && "error" in result && (
              <p role="alert" className="mt-3 text-sm font-semibold text-red-700" data-testid="order-error">{tc(`errors.${result.error}` as never)}</p>
            )}
            <p className="mt-3 text-xs text-slate">{tc("money")}</p>
          </>
        )}
      </aside>
    </div>
  );
}
