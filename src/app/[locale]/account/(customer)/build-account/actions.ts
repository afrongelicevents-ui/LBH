"use server";

import { z } from "zod";
import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserProfile } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseUploadRefs, storePrivate, takeIncoming, uploadErrorCode } from "@/lib/uploads";
import { parseDollarsToCents } from "@/lib/money";
import { rateLimited } from "@/lib/ratelimit";
import { sendEmail } from "@/lib/email";
import { site } from "@/config/site";
import { initiatePaynowPayment } from "@/lib/paynow";
import { baContext, type BaContext } from "@/lib/buildAccount/server";
import { receiptReader } from "@/lib/buildAccount/receiptReader";
import type { ParsedReceipt } from "@/lib/buildAccount/parseReceipt";

export type BaResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Signed-in client + whose Build Account (own, or one they were invited to). */
async function requireBa(ownerId?: string | null) {
  const { supabase, user, profile } = await getUserProfile();
  if (!user || !profile || profile.role !== "client") throw new Error("not authorised");
  const ctx = await baContext(supabase, user.id, ownerId);
  if (!ctx) throw new Error("not authorised");
  return { supabase, user, profile, ctx };
}

function fail(e: unknown, fallback = "error"): { ok: false; error: string } {
  const msg = e instanceof Error ? e.message : "";
  if (msg === "not authorised") return { ok: false, error: "auth" };
  if (/read-only|writable|row-level security/i.test(msg)) return { ok: false, error: "readonly" };
  const up = uploadErrorCode(e);
  return { ok: false, error: up !== "error" ? up : fallback };
}

function refresh() {
  revalidatePath("/[locale]/account/build-account", "layout");
}

async function writable(supabase: Awaited<ReturnType<typeof requireBa>>["supabase"], ctx: BaContext) {
  const { data } = await supabase.rpc("ba_writable", { p_owner: ctx.ownerId });
  return data === true;
}

// ---------- receipts ----------

/** Store the receipt photo privately and read shop, items and total from it. */
export async function readReceipt(
  ownerId: string,
  formData: FormData
): Promise<BaResult<{ path: string; parsed: ParsedReceipt; reader: string }>> {
  try {
    const { supabase, user, ctx } = await requireBa(ownerId);
    if (!(await writable(supabase, ctx))) return { ok: false, error: "readonly" };
    if (await rateLimited(`ba-ocr:${user.id}`, 60, 3600)) return { ok: false, error: "rate" };
    const [ref] = parseUploadRefs(formData.get("uploads_json"));
    if (!ref) return { ok: false, error: "invalid" };
    const f = await takeIncoming(user.id, ref, "ba-receipt");
    const path = await storePrivate("documents", `ba/${ctx.ownerId}`, f.buffer, f.contentType, f.ext);
    let parsed: ParsedReceipt = { shop: "", date: null, items: [], total_cents: null };
    const reader = receiptReader();
    if (f.isImage) {
      try {
        // never keep the person waiting: if reading is slow they type the details themselves
        let timer: ReturnType<typeof setTimeout> | undefined;
        const tooSlow = new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("reading took too long")), 40_000);
        });
        try {
          parsed = (await Promise.race([reader.read(f.buffer), tooSlow])).parsed;
        } finally {
          clearTimeout(timer);
        }
      } catch (e) {
        console.error(`[build-account] receipt reading failed: ${e instanceof Error ? e.message : e}`);
      }
    }
    return { ok: true, path, parsed, reader: reader.name };
  } catch (e) {
    console.error(`[build-account] readReceipt: ${e instanceof Error ? e.message : e}`);
    return fail(e, "upload");
  }
}

const itemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  qty: z.coerce.number().positive().max(100000).default(1),
  unit_cents: z.coerce.number().int().nonnegative().max(100000000).optional(),
  total_cents: z.coerce.number().int().nonnegative().max(100000000).optional(),
});

const spendSchema = z.object({
  account_id: z.string().regex(UUID),
  amount: z.string().trim().min(1).max(20),
  occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  shop: z.string().trim().max(120).default(""),
  description: z.string().trim().max(300).default(""),
  stage_name: z.string().trim().max(80).default(""),
  items_json: z.string().max(20000).default("[]"),
  receipt_path: z.string().max(200).default(""),
  source: z.enum(["manual", "scan"]).default("manual"),
});

/** "Confirm and deduct": money spent (with or without a receipt). */
export async function saveSpend(ownerId: string, _prev: BaResult | null, formData: FormData): Promise<BaResult> {
  try {
    const { supabase, ctx } = await requireBa(ownerId);
    const parsed = spendSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { ok: false, error: "invalid" };
    const d = parsed.data;
    const cents = parseDollarsToCents(d.amount);
    if (!cents) return { ok: false, error: "amount" };
    let items: z.infer<typeof itemSchema>[] = [];
    try {
      items = z.array(itemSchema).max(40).parse(JSON.parse(d.items_json));
    } catch {
      return { ok: false, error: "invalid" };
    }
    if (d.receipt_path && !d.receipt_path.startsWith(`ba/${ctx.ownerId}/`)) return { ok: false, error: "invalid" };
    const { error } = await supabase.from("ba_entries").insert({
      owner_id: ctx.ownerId,
      account_id: d.account_id,
      direction: "out",
      amount_cents: cents,
      occurred_on: d.occurred_on,
      shop: d.shop,
      description: d.description || d.shop,
      stage_name: d.stage_name || null,
      items,
      receipt_path: d.receipt_path || null,
      source: d.receipt_path ? d.source : "manual",
    });
    if (error) {
      console.error(`[build-account] saveSpend: ${error.message}`);
      return { ok: false, error: /row-level/.test(error.message) ? "readonly" : "db" };
    }
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

const moneySchema = z.object({
  account_id: z.string().regex(UUID),
  service: z.enum(["mukuru", "worldremit", "remitly", "bank", "card", "cash", "other"]),
  amount: z.string().trim().min(1).max(20),
  fee: z.string().trim().max(20).default(""),
  occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().trim().max(300).default(""),
});

/** "Add money": a transfer that stays "On its way" until the receiver confirms it. */
export async function addMoney(ownerId: string, _prev: BaResult | null, formData: FormData): Promise<BaResult> {
  try {
    const { supabase, ctx } = await requireBa(ownerId);
    if (!ctx.isOwner) return { ok: false, error: "auth" };
    const parsed = moneySchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { ok: false, error: "invalid" };
    const d = parsed.data;
    const cents = parseDollarsToCents(d.amount);
    const fee = d.fee ? parseDollarsToCents(d.fee) : 0;
    if (!cents || fee === null) return { ok: false, error: "amount" };
    const { error } = await supabase.from("ba_entries").insert({
      owner_id: ctx.ownerId,
      account_id: d.account_id,
      direction: "in",
      amount_cents: cents,
      fee_cents: fee,
      occurred_on: d.occurred_on,
      service: d.service,
      description: d.description,
    });
    if (error) return { ok: false, error: /row-level/.test(error.message) ? "readonly" : "db" };
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** The receiver (family member, or the owner for their own accounts) confirms money arrived. */
export async function confirmTransfer(ownerId: string, entryId: string, approve: boolean): Promise<BaResult> {
  try {
    const { supabase } = await requireBa(ownerId);
    if (!UUID.test(entryId)) return { ok: false, error: "invalid" };
    const { error } = await supabase.rpc("ba_confirm_transfer", { p_entry: entryId, p_approve: approve });
    if (error) return { ok: false, error: /only the person/.test(error.message) ? "notReceiver" : "db" };
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Add a receipt photo to money already spent. */
export async function attachReceipt(ownerId: string, entryId: string, formData: FormData): Promise<BaResult> {
  try {
    const { supabase, user, ctx } = await requireBa(ownerId);
    if (!UUID.test(entryId)) return { ok: false, error: "invalid" };
    const [ref] = parseUploadRefs(formData.get("uploads_json"));
    if (!ref) return { ok: false, error: "invalid" };
    const f = await takeIncoming(user.id, ref, "ba-receipt");
    const path = await storePrivate("documents", `ba/${ctx.ownerId}`, f.buffer, f.contentType, f.ext);
    const { error } = await supabase.rpc("ba_attach_receipt", { p_entry: entryId, p_path: path });
    if (error) {
      await createAdminClient().storage.from("documents").remove([path]);
      return { ok: false, error: "auth" };
    }
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e, "upload");
  }
}

export async function deleteEntry(ownerId: string, entryId: string): Promise<BaResult> {
  try {
    const { supabase, ctx } = await requireBa(ownerId);
    if (!ctx.isOwner || !UUID.test(entryId)) return { ok: false, error: "auth" };
    const { data, error } = await supabase.from("ba_entries").delete().eq("id", entryId).select("id");
    if (error || !data?.length) return { ok: false, error: "cannotDelete" };
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------- budgets & accounts ----------

export async function setBudget(stage: string, amount: string): Promise<BaResult> {
  try {
    const { supabase, ctx } = await requireBa(null);
    const name = stage.trim().slice(0, 80);
    if (!name) return { ok: false, error: "invalid" };
    if (amount.trim() === "") {
      await supabase.from("ba_budgets").delete().eq("owner_id", ctx.ownerId).eq("stage_name", name);
    } else {
      const cents = parseDollarsToCents(amount);
      if (cents === null) return { ok: false, error: "amount" };
      const { error } = await supabase
        .from("ba_budgets")
        .upsert({ owner_id: ctx.ownerId, stage_name: name, budget_cents: cents, updated_at: new Date().toISOString() });
      if (error) return { ok: false, error: /row-level/.test(error.message) ? "readonly" : "db" };
    }
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function addAccount(_prev: BaResult | null, formData: FormData): Promise<BaResult> {
  try {
    const { supabase, ctx } = await requireBa(null);
    const name = String(formData.get("name") ?? "").trim().slice(0, 80);
    const holder = String(formData.get("holder_member_id") ?? "");
    if (name.length < 2) return { ok: false, error: "invalid" };
    const { error } = await supabase.from("ba_accounts").insert({
      owner_id: ctx.ownerId,
      name,
      kind: holder ? "family" : String(formData.get("kind")) === "family" ? "family" : "own",
      holder_member_id: UUID.test(holder) ? holder : null,
    });
    if (error) return { ok: false, error: /row-level/.test(error.message) ? "readonly" : "db" };
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------- family ----------

const inviteSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    email: z.string().trim().email().max(254).optional().or(z.literal("")),
    whatsapp: z.string().trim().regex(/^\+?[0-9\s\-()]{7,20}$/).optional().or(z.literal("")),
    role: z.enum(["view", "add"]),
    holds_money: z.string().optional(),
  })
  .refine((d) => d.email || d.whatsapp, { message: "contact", path: ["email"] });

/** Invite a relative; the link is sent by email and/or shared on WhatsApp. */
export async function inviteMember(
  _prev: BaResult<{ link?: string; whatsappLink?: string }> | null,
  formData: FormData
): Promise<BaResult<{ link?: string; whatsappLink?: string }>> {
  try {
    const { supabase, user, profile, ctx } = await requireBa(null);
    if (await rateLimited(`ba-invite:${user.id}`, 20, 3600)) return { ok: false, error: "rate" };
    const parsed = inviteSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.path[0] === "email" ? "contact" : "invalid" };
    const d = parsed.data;
    const token = randomBytes(24).toString("base64url");
    const { data: m, error } = await supabase
      .from("ba_members")
      .insert({
        owner_id: ctx.ownerId,
        name: d.name,
        email: d.email || null,
        whatsapp: d.whatsapp || null,
        role: d.role,
        invite_token_hash: createHash("sha256").update(token).digest("hex"),
      })
      .select("id")
      .single();
    if (error || !m) return { ok: false, error: "db" };
    if (d.holds_money === "on") {
      await supabase.from("ba_accounts").insert({ owner_id: ctx.ownerId, name: d.name, kind: "family", holder_member_id: m.id });
    }
    const link = `${site.url}/build-account/join?t=${token}`;
    const text = `${profile.full_name || "Your relative"} invited you to see their LBH Build Account (the record of their house-build money)${d.role === "add" ? " and add receipts" : ""}. Open: ${link}`;
    if (d.email) await sendEmail({ to: d.email, subject: "LBH Build Account — you're invited", text: `${text}\n\nLBH — Let's Build Home` });
    const phone = (d.whatsapp ?? "").replace(/[^0-9]/g, "");
    refresh();
    return { ok: true, link, whatsappLink: phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : undefined };
  } catch (e) {
    return fail(e);
  }
}

export async function updateMember(memberId: string, patch: { role?: "view" | "add"; remove?: boolean }): Promise<BaResult> {
  try {
    const { supabase, ctx } = await requireBa(null);
    if (!UUID.test(memberId)) return { ok: false, error: "invalid" };
    const update = patch.remove ? { status: "removed" } : patch.role ? { role: patch.role } : null;
    if (!update) return { ok: false, error: "invalid" };
    const { error } = await supabase.from("ba_members").update(update).eq("id", memberId).eq("owner_id", ctx.ownerId);
    if (error) return { ok: false, error: "db" };
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Accept an invite (after logging in / creating an account). */
export async function acceptInvite(token: string, locale: string): Promise<BaResult> {
  let owner: string | null = null;
  try {
    const { supabase, profile } = await getUserProfile();
    if (!profile || profile.role !== "client") return { ok: false, error: "auth" };
    const { data, error } = await supabase.rpc("ba_accept_invite", { p_token: token });
    if (error) return { ok: false, error: /own Build/.test(error.message) ? "own" : "invite" };
    owner = data as string;
  } catch {
    return { ok: false, error: "error" };
  }
  redirect(`${locale === "en" ? "" : `/${locale}`}/account/build-account?owner=${owner}`);
}

// ---------- plans ----------

export async function startSubscription(plan: "monthly" | "yearly", locale: string): Promise<BaResult> {
  let target: string;
  try {
    const { user, profile, ctx } = await requireBa(null);
    if (!ctx.isOwner || !["monthly", "yearly"].includes(plan)) return { ok: false, error: "invalid" };
    const admin = createAdminClient();
    const { data: s } = await admin
      .from("settings")
      .select("build_account_enabled, build_account_monthly_cents, build_account_yearly_cents")
      .eq("id", 1)
      .single();
    const price = plan === "yearly" ? s?.build_account_yearly_cents : s?.build_account_monthly_cents;
    if (!s?.build_account_enabled || !price) return { ok: false, error: "planOff" };
    const ref = `LBH-BA-${randomBytes(6).toString("hex").toUpperCase()}`;
    const { error } = await admin
      .from("ba_payments")
      .insert({ owner_id: user.id, plan, amount_cents: price, merchant_reference: ref });
    if (error) return { ok: false, error: "db" };
    const prefix = locale === "en" ? "" : `/${locale}`;
    const result = await initiatePaynowPayment({
      merchantReference: ref,
      amountCents: price,
      email: profile.email,
      returnUrl: `${site.url}${prefix}/account/build-account/plans?ref=${ref}`,
    });
    if (!result.simulated) {
      await admin.from("ba_payments").update({ paynow_poll_url: result.pollUrl }).eq("merchant_reference", ref);
      target = result.redirectUrl;
    } else {
      target = `${prefix}/account/build-account/pay?ref=${ref}`;
    }
  } catch (e) {
    console.error(`[build-account] subscribe: ${e instanceof Error ? e.message : e}`);
    return fail(e, "paynow");
  }
  redirect(target);
}

/** TEST MODE ONLY: simulated checkout for a Build Account plan. */
export async function simulateBaPayment(ref: string, outcome: "paid" | "failed", locale: string): Promise<BaResult> {
  const { simulatedPaymentsEnabled } = await import("@/lib/paynow");
  const { confirmBaPaymentByReference, failBaPaymentByReference } = await import("@/lib/buildAccount/server");
  try {
    if (!simulatedPaymentsEnabled()) return { ok: false, error: "auth" };
    const { supabase } = await requireBa(null);
    // RLS: only the owner can read their own payment
    const { data: pay } = await supabase.from("ba_payments").select("merchant_reference").eq("merchant_reference", ref).maybeSingle();
    if (!pay) return { ok: false, error: "invalid" };
    if (outcome === "paid") await confirmBaPaymentByReference(ref, `SIMULATED-${Date.now()}`);
    else await failBaPaymentByReference(ref);
  } catch (e) {
    return fail(e);
  }
  refresh();
  redirect(`${locale === "en" ? "" : `/${locale}`}/account/build-account/plans?ref=${encodeURIComponent(ref)}`);
}
