"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdminAction } from "@/lib/auth/admin-guard";
import { parseDollarsToCents } from "@/lib/money";
import { sendRenewalReminders } from "@/lib/buildAccount/server";

export type BaAdminResult = { ok: true; count?: number } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const done = () => revalidatePath("/[locale]/admin", "layout");
const log = (supabase: Awaited<ReturnType<typeof requireAdminAction>>["supabase"], action: string, id: string, data: object = {}) =>
  supabase.rpc("admin_log_audit", { p_action: action, p_entity: "build_account", p_entity_id: id, p_data: data });

/** Prices (monthly required when the plan is on; yearly optional) and plan on/off. */
export async function saveBaSettings(_prev: BaAdminResult | null, fd: FormData): Promise<BaAdminResult> {
  try {
    const { supabase, user } = await requireAdminAction();
    const enabled = fd.get("enabled") === "on";
    const m = String(fd.get("monthly") ?? "").trim();
    const y = String(fd.get("yearly") ?? "").trim();
    const monthly = m ? parseDollarsToCents(m) : null;
    const yearly = y ? parseDollarsToCents(y) : null;
    if ((m && !monthly) || (y && !yearly)) return { ok: false, error: "invalid" };
    if (enabled && !monthly) return { ok: false, error: "monthlyNeeded" };
    const { error } = await supabase
      .from("settings")
      .update({
        build_account_enabled: enabled,
        build_account_monthly_cents: monthly,
        build_account_yearly_cents: yearly,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq("id", 1);
    if (error) return { ok: false, error: "db" };
    await log(supabase, "build_account.settings", "settings", { enabled, monthly, yearly });
    done();
    return { ok: true };
  } catch {
    return { ok: false, error: "auth" };
  }
}

/** Override one client's plan: auto (rules decide), free, paid until a date, or expired (read-only). */
export async function setBaOverride(ownerId: string, override: string, until: string, note: string): Promise<BaAdminResult> {
  try {
    const { supabase, user } = await requireAdminAction();
    if (!UUID.test(ownerId) || !["auto", "free", "paid", "expired"].includes(override)) return { ok: false, error: "invalid" };
    const untilOk = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse(until).success;
    if (override === "paid" && until && !untilOk) return { ok: false, error: "invalid" };
    const { data: client } = await supabase.from("profiles").select("role").eq("id", ownerId).maybeSingle();
    if (client?.role !== "client") return { ok: false, error: "invalid" };
    const { error } = await supabase.from("ba_subscriptions").upsert(
      {
        owner_id: ownerId,
        override: override === "auto" ? null : override,
        override_until: override === "paid" && untilOk ? `${until}T23:59:59Z` : null,
        override_note: note.trim().slice(0, 300),
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "owner_id" }
    );
    if (error) return { ok: false, error: "db" };
    await log(supabase, "build_account.override", ownerId, { override, until: untilOk ? until : null });
    done();
    return { ok: true };
  } catch {
    return { ok: false, error: "auth" };
  }
}

/** LBH received money that a client sent to the LBH account (or it never arrived). */
export async function confirmLbhTransfer(entryId: string, approve: boolean): Promise<BaAdminResult> {
  try {
    const { supabase } = await requireAdminAction();
    if (!UUID.test(entryId)) return { ok: false, error: "invalid" };
    const { error } = await supabase.rpc("ba_confirm_transfer", { p_entry: entryId, p_approve: approve });
    if (error) return { ok: false, error: "db" };
    await log(supabase, approve ? "build_account.transfer_confirmed" : "build_account.transfer_rejected", entryId);
    done();
    return { ok: true };
  } catch {
    return { ok: false, error: "auth" };
  }
}

export async function sendBaReminders(): Promise<BaAdminResult> {
  try {
    await requireAdminAction();
    const count = await sendRenewalReminders();
    return { ok: true, count };
  } catch {
    return { ok: false, error: "auth" };
  }
}

// ---------- price list ----------
const priceSchema = z.object({
  item: z.string().trim().min(2).max(120),
  unit: z.string().trim().min(1).max(40),
  area: z.string().trim().min(1).max(80),
  price: z.string().trim().min(1).max(20),
});

export async function savePriceItem(id: string | null, _prev: BaAdminResult | null, fd: FormData): Promise<BaAdminResult> {
  try {
    const { supabase, user } = await requireAdminAction();
    const parsed = priceSchema.safeParse(Object.fromEntries(fd.entries()));
    if (!parsed.success) return { ok: false, error: "invalid" };
    const cents = parseDollarsToCents(parsed.data.price);
    if (!cents) return { ok: false, error: "invalid" };
    const row = { item: parsed.data.item, unit: parsed.data.unit, area: parsed.data.area, price_cents: cents, updated_by: user.id, updated_at: new Date().toISOString() };
    if (id && !UUID.test(id)) return { ok: false, error: "invalid" };
    const { error } = id ? await supabase.from("price_list").update(row).eq("id", id) : await supabase.from("price_list").insert(row);
    if (error) return { ok: false, error: "db" };
    await log(supabase, id ? "price_list.updated" : "price_list.added", id ?? parsed.data.item);
    done();
    return { ok: true };
  } catch {
    return { ok: false, error: "auth" };
  }
}

export async function deletePriceItem(id: string): Promise<BaAdminResult> {
  try {
    const { supabase } = await requireAdminAction();
    if (!UUID.test(id)) return { ok: false, error: "invalid" };
    const { error } = await supabase.from("price_list").delete().eq("id", id);
    if (error) return { ok: false, error: "db" };
    await log(supabase, "price_list.deleted", id);
    done();
    return { ok: true };
  } catch {
    return { ok: false, error: "auth" };
  }
}
