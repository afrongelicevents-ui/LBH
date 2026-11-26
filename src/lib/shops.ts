import "server-only";
import { cache } from "react";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { ShopCategory } from "@/config/shops";

/** Public shop data (approved shops only — RLS), read with the anon key. */
function anon() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface PublicShop {
  id: string;
  slug: string;
  name: string;
  area: string;
  about: string;
  categories: string[];
  fair_price_agreed_at: string | null;
}
export interface PublicItem {
  id: string;
  shop_id: string;
  name: string;
  category: ShopCategory;
  unit: string;
  price_cents: number;
  in_stock: boolean;
  updated_at: string;
}

const SHOP_COLS = "id, slug, name, area, about, categories, fair_price_agreed_at";
const ITEM_COLS = "id, shop_id, name, category, unit, price_cents, in_stock, updated_at";

export const loadShops = cache(async (): Promise<PublicShop[]> => {
  try {
    const { data } = await anon().from("shops").select(SHOP_COLS).order("name");
    return (data ?? []) as PublicShop[];
  } catch {
    return [];
  }
});

export const loadShop = cache(async (slug: string): Promise<{ shop: PublicShop; items: PublicItem[] } | null> => {
  if (!/^[a-z0-9][a-z0-9-]{1,59}$/.test(slug)) return null;
  try {
    const db = anon();
    const { data: shop } = await db.from("shops").select(SHOP_COLS).eq("slug", slug).maybeSingle();
    if (!shop) return null;
    const { data: items } = await db.from("shop_items").select(ITEM_COLS).eq("shop_id", shop.id).order("category").order("name");
    return { shop: shop as PublicShop, items: (items ?? []) as PublicItem[] };
  } catch {
    return null;
  }
});

/** Items across all approved shops, cheapest first (for comparing). */
export const loadItems = cache(async (category: string | null, q: string | null): Promise<PublicItem[]> => {
  try {
    let query = anon().from("shop_items").select(ITEM_COLS).order("price_cents").limit(200);
    if (category) query = query.eq("category", category);
    const term = (q ?? "").replace(/[%_,()]/g, " ").trim().slice(0, 60);
    if (term) query = query.ilike("name", `%${term}%`);
    const { data } = await query;
    return (data ?? []) as PublicItem[];
  } catch {
    return [];
  }
});

/** "SAMPLE ..." rows only exist in local/test data. */
export const clean = (s: string) => s.replace(/^SAMPLE\s+/, "");

/** Order code shown to the client and the shop, e.g. LBH-7K3QPA (no 0/O/1/I). */
export function newOrderCode(): string {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return "LBH-" + Array.from(bytes, (b) => A[b % A.length]).join("");
}

export function slugify(name: string): string {
  const s = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return s.length >= 2 ? s : `shop-${Date.now().toString(36)}`;
}

/** Totals for an order: what the PM may pay now, and whether the client must approve first. */
export function settleOrder(lines: { qty: number; price_cents: number; shelf_price_cents: number | null; available: boolean }[]) {
  let pay = 0;
  let cheaper = false;
  let needsClient = false;
  for (const l of lines) {
    if (!l.available) {
      needsClient = true;
      continue;
    }
    const shelf = l.shelf_price_cents ?? l.price_cents;
    if (shelf > l.price_cents) needsClient = true;
    if (shelf < l.price_cents) cheaper = true;
    pay += l.qty * shelf; // lower shelf price → the client pays less; higher → only after the client agrees
  }
  return { pay, cheaper, needsClient };
}
