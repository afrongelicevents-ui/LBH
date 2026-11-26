"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getUserProfile } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimited } from "@/lib/ratelimit";
import { alertTeam } from "@/lib/inbox";
import { formatCents } from "@/lib/money";
import { clean, newOrderCode, slugify } from "@/lib/shops";
import { SHOP_CATEGORIES, SHOP_ORDER_MAX_LINES } from "@/config/shops";

export type ShopResult = { ok: true; code?: string; id?: string } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// ---------------------------------------------------------------------
// Shops apply to be listed (public form)
// ---------------------------------------------------------------------
const applySchema = z.object({
  name: z.string().trim().min(2).max(100),
  area: z.string().trim().min(2).max(80),
  address: z.string().trim().max(200).default(""),
  contact_name: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(6).max(40),
  email: z.string().trim().email().max(254).or(z.literal("")).default(""),
  notes: z.string().trim().max(4000).default(""),
  agree: z.literal("on"),
});

export async function applyShop(_prev: ShopResult | null, fd: FormData): Promise<ShopResult> {
  try {
    if (String(fd.get("website") ?? "")) return { ok: true }; // honeypot
    const parsed = applySchema.safeParse(Object.fromEntries(fd.entries()));
    if (!parsed.success) {
      const missingAgree = parsed.error.issues.some((i) => i.path[0] === "agree");
      return { ok: false, error: missingAgree ? "agree" : "invalid" };
    }
    if (await rateLimited("shop-apply", 5, 3600)) return { ok: false, error: "rate" };
    const cats = fd.getAll("categories").map(String).filter((c) => (SHOP_CATEGORIES as readonly string[]).includes(c));
    const d = parsed.data;
    const db = createAdminClient();
    let slug = slugify(d.name);
    const { data: taken } = await db.from("shops").select("id").eq("slug", slug).maybeSingle();
    if (taken) slug = `${slug.slice(0, 52)}-${Math.random().toString(36).slice(2, 6)}`;
    const { data: shop, error } = await db
      .from("shops")
      .insert({ slug, name: d.name, area: d.area, address: d.address, categories: cats, status: "pending", fair_price_agreed_at: new Date().toISOString() })
      .select("id")
      .single();
    if (error || !shop) return { ok: false, error: "db" };
    await db.from("shop_contacts").insert({ shop_id: shop.id, contact_name: d.contact_name, phone: d.phone, email: d.email, notes: d.notes });
    await alertTeam({
      kind: "shop",
      ref: shop.id,
      title: `New shop wants to join: ${d.name}`,
      lines: [`${d.name} (${d.area}) applied to be listed on LBH Shops and agreed to the fair-price rules.`, `Contact: ${d.contact_name}, ${d.phone}${d.email ? `, ${d.email}` : ""}.`, "Check the shop, add its prices, then approve it."],
      path: `/admin/shops/${shop.id}`,
    });
    return { ok: true };
  } catch (e) {
    console.error(`[shops] apply: ${e instanceof Error ? e.message : e}`);
    return { ok: false, error: "error" };
  }
}

// ---------------------------------------------------------------------
// Clients: place, cancel, accept a change
// ---------------------------------------------------------------------
async function requireClient() {
  const { user, profile } = await getUserProfile();
  if (!user || !profile) throw new Error("login");
  if (profile.role !== "client") throw new Error("role");
  return { user, profile };
}

const orderSchema = z.object({
  shopId: z.string().regex(UUID),
  note: z.string().trim().max(500).default(""),
  lines: z
    .array(z.object({ itemId: z.string().regex(UUID), qty: z.number().int().min(1).max(100000) }))
    .min(1)
    .max(SHOP_ORDER_MAX_LINES),
});

/**
 * Place an order with one shop. Prices are read on the server and LOCKED on
 * the order; the client never sends prices. Returns the order code.
 */
export async function placeShopOrder(input: { shopId: string; note?: string; lines: { itemId: string; qty: number }[] }): Promise<ShopResult> {
  let who: Awaited<ReturnType<typeof requireClient>>;
  try {
    who = await requireClient();
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.message === "role" ? "role" : "login" };
  }
  try {
    const p = orderSchema.safeParse(input);
    if (!p.success) return { ok: false, error: "invalid" };
    if (await rateLimited(`shop-order:${who.user.id}`, 20, 3600)) return { ok: false, error: "rate" };
    const db = createAdminClient();
    const { data: shop } = await db.from("shops").select("id, name, status").eq("id", p.data.shopId).maybeSingle();
    if (!shop || shop.status !== "approved") return { ok: false, error: "shop" };
    const ids = Array.from(new Set(p.data.lines.map((l) => l.itemId)));
    const { data: items } = await db.from("shop_items").select("id, name, unit, price_cents, in_stock").eq("shop_id", shop.id).in("id", ids);
    const byId = new Map((items ?? []).map((i) => [i.id, i]));
    const qty = new Map<string, number>();
    for (const l of p.data.lines) qty.set(l.itemId, Math.min(100000, (qty.get(l.itemId) ?? 0) + l.qty));
    const lines = Array.from(qty.entries()).map(([id, q]) => ({ item: byId.get(id), q }));
    if (lines.some((l) => !l.item || !l.item.in_stock)) return { ok: false, error: "stale" };
    const total = lines.reduce((s, l) => s + l.item!.price_cents * l.q, 0);

    let order: { id: string; code: string } | null = null;
    for (let i = 0; i < 4 && !order; i++) {
      const { data, error } = await db
        .from("shop_orders")
        .insert({ code: newOrderCode(), client_id: who.user.id, shop_id: shop.id, total_cents: total, client_note: p.data.note })
        .select("id, code")
        .single();
      if (data) order = data;
      else if (error && error.code !== "23505") return { ok: false, error: "db" };
    }
    if (!order) return { ok: false, error: "db" };
    const { error: e2 } = await db.from("shop_order_items").insert(
      lines.map((l) => ({ order_id: order!.id, item_id: l.item!.id, name: l.item!.name, unit: l.item!.unit, qty: l.q, price_cents: l.item!.price_cents }))
    );
    if (e2) {
      await db.from("shop_orders").delete().eq("id", order.id);
      return { ok: false, error: "db" };
    }
    await alertTeam({
      kind: "shop",
      ref: order.id,
      title: `Shop order ${order.code} — ${clean(shop.name)}`,
      lines: [
        `${who.profile.full_name || "A client"} ordered ${lines.length} item(s) from ${clean(shop.name)}, total ${formatCents(total)} at app prices.`,
        "Check the client has enough money with LBH, then assign a project manager to buy it.",
      ],
      path: "/admin/shops/orders",
    });
    revalidatePath("/[locale]/account", "layout");
    return { ok: true, code: order.code, id: order.id };
  } catch (e) {
    console.error(`[shops] place: ${e instanceof Error ? e.message : e}`);
    return { ok: false, error: "error" };
  }
}

async function ownOrder(orderId: string) {
  const who = await requireClient();
  if (!UUID.test(orderId)) throw new Error("invalid");
  const db = createAdminClient();
  const { data: o } = await db.from("shop_orders").select("id, code, status, client_id").eq("id", orderId).maybeSingle();
  if (!o || o.client_id !== who.user.id) throw new Error("invalid");
  return { db, o, who };
}

/** The client can cancel until the project manager has bought it. */
export async function cancelShopOrder(orderId: string): Promise<ShopResult> {
  try {
    const { db, o } = await ownOrder(orderId);
    if (!["placed", "assigned", "changed"].includes(o.status)) return { ok: false, error: "state" };
    const { error } = await db.from("shop_orders").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", o.id).in("status", ["placed", "assigned", "changed"]);
    if (error) return { ok: false, error: "db" };
    revalidatePath("/[locale]/account", "layout");
    return { ok: true };
  } catch {
    return { ok: false, error: "auth" };
  }
}

/** Accept the project manager's changes (new prices, missing items dropped). */
export async function acceptShopChange(orderId: string): Promise<ShopResult> {
  try {
    const { db, o } = await ownOrder(orderId);
    if (o.status !== "changed") return { ok: false, error: "state" };
    const { data: lines } = await db.from("shop_order_items").select("id, qty, price_cents, shelf_price_cents, available").eq("order_id", o.id);
    const keep = (lines ?? []).filter((l) => l.available);
    if (!keep.length) {
      await db.from("shop_orders").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", o.id);
      revalidatePath("/[locale]/account", "layout");
      return { ok: true };
    }
    // New locked prices = what the shop really charges now
    for (const l of keep) {
      if (l.shelf_price_cents && l.shelf_price_cents !== l.price_cents) {
        await db.from("shop_order_items").update({ price_cents: l.shelf_price_cents, shelf_price_cents: null }).eq("id", l.id);
      }
    }
    await db.from("shop_order_items").delete().eq("order_id", o.id).eq("available", false);
    const total = keep.reduce((s, l) => s + l.qty * (l.shelf_price_cents ?? l.price_cents), 0);
    const { error } = await db.from("shop_orders").update({ status: "assigned", total_cents: total, updated_at: new Date().toISOString() }).eq("id", o.id).eq("status", "changed");
    if (error) return { ok: false, error: "db" };
    revalidatePath("/[locale]/account", "layout");
    return { ok: true };
  } catch {
    return { ok: false, error: "auth" };
  }
}
