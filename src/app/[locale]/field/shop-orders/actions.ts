"use server";

import { revalidatePath } from "next/cache";
import { requireFieldAction } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseUploadRefs, storePrivate, takeIncoming } from "@/lib/uploads";
import { parseDollarsToCents, formatCents } from "@/lib/money";
import { alertTeam } from "@/lib/inbox";
import { sendEmail } from "@/lib/email";
import { brandedHtml, brandedText } from "@/lib/emailLayout";
import { site } from "@/config/site";
import { clean, settleOrder } from "@/lib/shops";

export type FieldShopResult = { ok: true; status: "bought" | "changed" } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * The project manager is at the shop with the order code. For each line they
 * enter the shelf price (only if different) and untick items that are not
 * there. Then:
 *  - everything there and no price higher → BOUGHT (receipt photo required);
 *    a lower shelf price means the client pays less and the shop gets a warning;
 *  - a missing item or a higher price → CHANGED: the client decides first.
 */
export async function reportShopOrder(orderId: string, _prev: FieldShopResult | null, fd: FormData): Promise<FieldShopResult> {
  try {
    const { user } = await requireFieldAction();
    if (!UUID.test(orderId)) return { ok: false, error: "invalid" };
    const db = createAdminClient();
    const { data: o } = await db
      .from("shop_orders")
      .select("id, code, status, assigned_to, client_id, shop_id, shops(name), shop_order_items(id, name, qty, price_cents)")
      .eq("id", orderId)
      .single();
    if (!o || o.assigned_to !== user.id) return { ok: false, error: "invalid" };
    if (o.status !== "assigned") return { ok: false, error: "state" };

    const lines = (o.shop_order_items ?? []).map((l) => {
      const raw = String(fd.get(`shelf_${l.id}`) ?? "").trim();
      const shelf = raw ? parseDollarsToCents(raw) : null;
      return { ...l, shelf_price_cents: shelf && shelf !== l.price_cents ? shelf : null, available: fd.get(`avail_${l.id}`) === "on", badPrice: Boolean(raw && !shelf) };
    });
    if (lines.some((l) => l.badPrice)) return { ok: false, error: "price" };
    const note = String(fd.get("field_note") ?? "").trim().slice(0, 500);
    const { pay, cheaper, needsClient } = settleOrder(lines);

    let receiptPath: string | null = null;
    if (!needsClient) {
      const [ref] = parseUploadRefs(fd.get("uploads_json"));
      if (!ref) return { ok: false, error: "receipt" };
      const f = await takeIncoming(user.id, ref, "staff-media");
      receiptPath = await storePrivate("documents", `shop-orders/${o.id}`, f.buffer, f.contentType, f.ext);
    }

    for (const l of lines) {
      await db.from("shop_order_items").update({ shelf_price_cents: l.shelf_price_cents, available: l.available }).eq("id", l.id);
    }
    const now = new Date().toISOString();
    const shopName = clean((o.shops as unknown as { name: string } | null)?.name ?? "the shop");

    if (needsClient) {
      await db.from("shop_orders").update({ status: "changed", field_note: note, updated_at: now }).eq("id", o.id);
      const { data: client } = await db.from("profiles").select("email, full_name").eq("id", o.client_id).single();
      if (client?.email) {
        const mail = {
          preheader: `Your order ${o.code} needs your OK`,
          title: "Your shop order needs your OK",
          paragraphs: [
            `Our project manager is at ${shopName} with your order ${o.code}. Some items are not in stock or the price has changed.`,
            "Please open your order, check the changes and accept or cancel. Nothing is bought until you decide.",
          ],
          button: { label: "Check my order", href: `${site.url}/account/shop-orders` },
        };
        await sendEmail({ to: client.email, subject: `LBH — order ${o.code} needs your OK`, text: brandedText(mail), html: brandedHtml(mail) }).catch(() => undefined);
      }
    } else {
      await db
        .from("shop_orders")
        .update({ status: "bought", paid_cents: pay, receipt_path: receiptPath, field_note: note, bought_at: now, updated_at: now })
        .eq("id", o.id);
      if (cheaper) {
        // Fair-price rule: app price above the walk-in price → warning (2 warnings = suspended)
        const { data: s } = await db.from("shops").select("warnings, status").eq("id", o.shop_id).single();
        const warnings = (s?.warnings ?? 0) + 1;
        await db.from("shops").update({ warnings, status: warnings >= 2 ? "suspended" : s?.status, updated_at: now }).eq("id", o.shop_id);
        await alertTeam({
          kind: "shop",
          ref: o.shop_id,
          title: `Fair-price warning: ${shopName}`,
          lines: [
            `On order ${o.code} the shelf price at ${shopName} was LOWER than the price listed on LBH. The client paid the lower price (${formatCents(pay)}).`,
            warnings >= 2 ? "This is the second warning: the shop has been suspended from LBH Shops." : "This is the first warning. A second one suspends the shop.",
          ],
          path: `/admin/shops/${o.shop_id}`,
        });
      }
    }
    revalidatePath("/[locale]/field", "layout");
    revalidatePath("/[locale]/admin", "layout");
    return { ok: true, status: needsClient ? "changed" : "bought" };
  } catch (e) {
    console.error(`[shops] report: ${e instanceof Error ? e.message : e}`);
    return { ok: false, error: "error" };
  }
}
