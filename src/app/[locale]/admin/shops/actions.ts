"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdminAction } from "@/lib/auth/admin-guard";
import { parseDollarsToCents } from "@/lib/money";
import { slugify } from "@/lib/shops";
import { SHOP_CATEGORIES } from "@/config/shops";

export type ShopAdminResult = { ok: true; id?: string } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const done = () => {
  revalidatePath("/[locale]/admin", "layout");
  revalidatePath("/[locale]/shops", "layout");
};
type Db = Awaited<ReturnType<typeof requireAdminAction>>["supabase"];
const log = (db: Db, action: string, id: string, data: object = {}) =>
  db.rpc("admin_log_audit", { p_action: action, p_entity: "shop", p_entity_id: id, p_data: data });

const shopSchema = z.object({
  name: z.string().trim().min(2).max(100),
  area: z.string().trim().max(80).default(""),
  address: z.string().trim().max(200).default(""),
  about: z.string().trim().max(600).default(""),
  contact_name: z.string().trim().max(100).default(""),
  phone: z.string().trim().max(40).default(""),
  email: z.string().trim().max(254).default(""),
  notes: z.string().trim().max(4000).default(""),
});

/** Add or edit a shop (details, contact, fair-price agreement). */
export async function saveShop(id: string | null, _prev: ShopAdminResult | null, fd: FormData): Promise<ShopAdminResult> {
  try {
    const { supabase } = await requireAdminAction();
    if (id && !UUID.test(id)) return { ok: false, error: "invalid" };
    const p = shopSchema.safeParse(Object.fromEntries(fd.entries()));
    if (!p.success) return { ok: false, error: "invalid" };
    const cats = fd.getAll("categories").map(String).filter((c) => (SHOP_CATEGORIES as readonly string[]).includes(c));
    const agreed = fd.get("agreed") === "on";
    const { contact_name, phone, email, notes, ...pub } = p.data;
    const now = new Date().toISOString();
    let shopId = id;
    if (id) {
      const { data: cur } = await supabase.from("shops").select("fair_price_agreed_at").eq("id", id).single();
      const { error } = await supabase
        .from("shops")
        .update({ ...pub, categories: cats, fair_price_agreed_at: agreed ? (cur?.fair_price_agreed_at ?? now) : null, updated_at: now })
        .eq("id", id);
      if (error) return { ok: false, error: "db" };
    } else {
      let slug = slugify(pub.name);
      const { data: taken } = await supabase.from("shops").select("id").eq("slug", slug).maybeSingle();
      if (taken) slug = `${slug.slice(0, 52)}-${Math.random().toString(36).slice(2, 6)}`;
      const { data, error } = await supabase
        .from("shops")
        .insert({ ...pub, slug, categories: cats, status: "pending", fair_price_agreed_at: agreed ? now : null })
        .select("id")
        .single();
      if (error || !data) return { ok: false, error: "db" };
      shopId = data.id;
    }
    const { error: ce } = await supabase.from("shop_contacts").upsert({ shop_id: shopId!, contact_name, phone, email, notes });
    if (ce) return { ok: false, error: "db" };
    await log(supabase, id ? "shop.updated" : "shop.added", shopId!);
    done();
    return { ok: true, id: shopId! };
  } catch {
    return { ok: false, error: "auth" };
  }
}

/** Approve (only with the fair-price agreement), suspend or reopen a shop. */
export async function setShopStatus(id: string, status: "approved" | "suspended" | "pending"): Promise<ShopAdminResult> {
  try {
    const { supabase } = await requireAdminAction();
    if (!UUID.test(id) || !["approved", "suspended", "pending"].includes(status)) return { ok: false, error: "invalid" };
    if (status === "approved") {
      const { data } = await supabase.from("shops").select("fair_price_agreed_at").eq("id", id).single();
      if (!data?.fair_price_agreed_at) return { ok: false, error: "agreement" };
    }
    const { error } = await supabase.from("shops").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return { ok: false, error: "db" };
    await log(supabase, `shop.${status}`, id);
    done();
    return { ok: true };
  } catch {
    return { ok: false, error: "auth" };
  }
}

/** Fair-price warnings: +1 or reset. Two warnings → the shop is suspended. */
export async function setShopWarnings(id: string, mode: "add" | "reset"): Promise<ShopAdminResult> {
  try {
    const { supabase } = await requireAdminAction();
    if (!UUID.test(id)) return { ok: false, error: "invalid" };
    const { data } = await supabase.from("shops").select("warnings, status").eq("id", id).single();
    if (!data) return { ok: false, error: "invalid" };
    const warnings = mode === "reset" ? 0 : data.warnings + 1;
    const status = warnings >= 2 ? "suspended" : data.status;
    const { error } = await supabase.from("shops").update({ warnings, status, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return { ok: false, error: "db" };
    await log(supabase, `shop.warning.${mode}`, id, { warnings });
    done();
    return { ok: true };
  } catch {
    return { ok: false, error: "auth" };
  }
}

const itemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  category: z.enum(SHOP_CATEGORIES),
  unit: z.string().trim().min(1).max(40),
  price: z.string().trim().min(1).max(20),
});

export async function saveShopItem(shopId: string, itemId: string | null, _prev: ShopAdminResult | null, fd: FormData): Promise<ShopAdminResult> {
  try {
    const { supabase } = await requireAdminAction();
    if (!UUID.test(shopId) || (itemId && !UUID.test(itemId))) return { ok: false, error: "invalid" };
    const p = itemSchema.safeParse(Object.fromEntries(fd.entries()));
    if (!p.success) return { ok: false, error: "invalid" };
    const cents = parseDollarsToCents(p.data.price);
    if (!cents) return { ok: false, error: "invalid" };
    const row = { name: p.data.name, category: p.data.category, unit: p.data.unit, price_cents: cents, in_stock: fd.get("in_stock") !== "off", updated_at: new Date().toISOString() };
    const { error } = itemId
      ? await supabase.from("shop_items").update(row).eq("id", itemId).eq("shop_id", shopId)
      : await supabase.from("shop_items").insert({ ...row, shop_id: shopId });
    if (error) return { ok: false, error: "db" };
    await log(supabase, itemId ? "shop.item.updated" : "shop.item.added", shopId, { name: p.data.name, price_cents: cents });
    done();
    return { ok: true };
  } catch {
    return { ok: false, error: "auth" };
  }
}

export async function toggleShopItemStock(itemId: string, inStock: boolean): Promise<ShopAdminResult> {
  try {
    const { supabase } = await requireAdminAction();
    if (!UUID.test(itemId)) return { ok: false, error: "invalid" };
    const { error } = await supabase.from("shop_items").update({ in_stock: inStock, updated_at: new Date().toISOString() }).eq("id", itemId);
    if (error) return { ok: false, error: "db" };
    done();
    return { ok: true };
  } catch {
    return { ok: false, error: "auth" };
  }
}

export async function deleteShopItem(itemId: string): Promise<ShopAdminResult> {
  try {
    const { supabase } = await requireAdminAction();
    if (!UUID.test(itemId)) return { ok: false, error: "invalid" };
    const { error } = await supabase.from("shop_items").delete().eq("id", itemId);
    if (error) return { ok: false, error: "db" };
    await log(supabase, "shop.item.deleted", itemId);
    done();
    return { ok: true };
  } catch {
    return { ok: false, error: "auth" };
  }
}

/** Give a placed order to a project manager (field staff) to buy. */
export async function assignShopOrder(orderId: string, fieldId: string): Promise<ShopAdminResult> {
  try {
    const { supabase } = await requireAdminAction();
    if (!UUID.test(orderId) || !UUID.test(fieldId)) return { ok: false, error: "invalid" };
    const { data: pm } = await supabase.from("profiles").select("id, role").eq("id", fieldId).single();
    if (pm?.role !== "field") return { ok: false, error: "invalid" };
    const { error } = await supabase
      .from("shop_orders")
      .update({ assigned_to: fieldId, status: "assigned", updated_at: new Date().toISOString() })
      .eq("id", orderId)
      .in("status", ["placed", "assigned"]);
    if (error) return { ok: false, error: "db" };
    await log(supabase, "shop.order.assigned", orderId, { to: fieldId });
    done();
    return { ok: true };
  } catch {
    return { ok: false, error: "auth" };
  }
}

export async function adminCancelShopOrder(orderId: string): Promise<ShopAdminResult> {
  try {
    const { supabase } = await requireAdminAction();
    if (!UUID.test(orderId)) return { ok: false, error: "invalid" };
    const { error } = await supabase
      .from("shop_orders")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", orderId)
      .in("status", ["placed", "assigned", "changed"]);
    if (error) return { ok: false, error: "db" };
    await log(supabase, "shop.order.cancelled", orderId);
    done();
    return { ok: true };
  } catch {
    return { ok: false, error: "auth" };
  }
}
