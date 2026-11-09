import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_STAGES } from "@/lib/stages";
import { sendEmail } from "@/lib/email";
import { site } from "@/config/site";
import type { BaAccount, BaEntry, PriceItem } from "./math";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type BaPlan = "free" | "paid" | "expired" | "none";

export interface BaContext {
  ownerId: string;
  isOwner: boolean;
  /** set when the viewer is a family member of someone else's Build Account */
  member: { id: string; role: "view" | "add"; name: string } | null;
}

/**
 * Whose Build Account the viewer is looking at: their own, or one they
 * were invited to (?owner=…). Returns null if they may not see it.
 */
export async function baContext(
  supabase: SupabaseClient,
  viewerId: string,
  ownerParam?: string | null
): Promise<BaContext | null> {
  if (!ownerParam || ownerParam === viewerId) return { ownerId: viewerId, isOwner: true, member: null };
  if (!UUID.test(ownerParam)) return null;
  const { data: m } = await supabase
    .from("ba_members")
    .select("id, role, name")
    .eq("owner_id", ownerParam)
    .eq("user_id", viewerId)
    .eq("status", "active")
    .maybeSingle();
  if (!m) return null;
  return { ownerId: ownerParam, isOwner: false, member: m as BaContext["member"] };
}

/** Build Accounts the viewer was invited to (for the switcher). */
export async function sharedWithMe(supabase: SupabaseClient, viewerId: string) {
  const { data } = await supabase
    .from("ba_members")
    .select("owner_id, role")
    .eq("user_id", viewerId)
    .eq("status", "active");
  if (!data?.length) return [];
  const { data: owners } = await createAdminClient()
    .from("profiles")
    .select("id, full_name")
    .in("id", data.map((d) => d.owner_id));
  return data.map((d) => ({
    owner_id: d.owner_id as string,
    role: d.role as "view" | "add",
    name: owners?.find((o) => o.id === d.owner_id)?.full_name ?? "",
  }));
}

/**
 * The LBH account exists for every Build Account, and everything a client
 * paid in the LBH portal or that LBH bought for their build appears
 * automatically (no double entry). Idempotent: each source row once.
 */
export async function syncFromLbh(ownerId: string): Promise<void> {
  const admin = createAdminClient();
  let { data: lbh } = await admin.from("ba_accounts").select("id").eq("owner_id", ownerId).eq("kind", "lbh").maybeSingle();
  if (!lbh) {
    await admin.from("ba_accounts").insert({ owner_id: ownerId, name: "LBH account", kind: "lbh" });
    ({ data: lbh } = await admin.from("ba_accounts").select("id").eq("owner_id", ownerId).eq("kind", "lbh").maybeSingle());
  }
  if (!lbh) return;

  const { data: requests } = await admin.from("service_requests").select("id, title, type").eq("client_id", ownerId);
  const reqIds = (requests ?? []).map((r) => r.id);
  if (reqIds.length === 0) return;
  const titleOf = (id: string) => (requests ?? []).find((r) => r.id === id)?.title ?? "";

  const rows: Record<string, unknown>[] = [];
  const { data: payments } = await admin
    .from("payments")
    .select("id, request_id, kind, amount_cents, confirmed_at, stage_id, merchant_reference")
    .in("request_id", reqIds)
    .eq("status", "confirmed");
  for (const p of payments ?? []) {
    const day = String(p.confirmed_at ?? new Date().toISOString()).slice(0, 10);
    rows.push({
      owner_id: ownerId,
      account_id: lbh.id,
      direction: "in",
      amount_cents: p.amount_cents,
      occurred_on: day,
      description: `Paid to LBH in the portal — ${titleOf(p.request_id)}`.slice(0, 300),
      status: "confirmed",
      confirmed_at: p.confirmed_at,
      source: "lbh_payment",
      source_ref: p.id,
    });
    // LBH service fees are spent straight away (the LBH invoice is the receipt);
    // stage materials money stays until LBH buys the materials.
    if (p.kind !== "materials") {
      rows.push({
        owner_id: ownerId,
        account_id: lbh.id,
        direction: "out",
        amount_cents: p.amount_cents,
        occurred_on: day,
        description: `LBH service (${p.kind}) — ${titleOf(p.request_id)}`.slice(0, 300),
        shop: "LBH",
        receipt_source: "lbh",
        source: "lbh_fee",
        source_ref: p.id,
      });
    }
  }

  const { data: stages } = await admin.from("build_stages").select("id, name").in("request_id", reqIds);
  if (stages?.length) {
    const { data: purchases } = await admin
      .from("stage_purchases")
      .select("id, stage_id, supplier_name, amount_cents, receipt_media_id, created_at, note")
      .in("stage_id", stages.map((s) => s.id));
    for (const pu of purchases ?? []) {
      const stage = stages.find((s) => s.id === pu.stage_id)?.name ?? null;
      rows.push({
        owner_id: ownerId,
        account_id: lbh.id,
        direction: "out",
        amount_cents: pu.amount_cents,
        occurred_on: String(pu.created_at).slice(0, 10),
        description: `Materials bought by LBH${stage ? ` — ${stage}` : ""}`,
        shop: pu.supplier_name,
        stage_name: stage,
        receipt_source: pu.receipt_media_id ? "lbh" : null,
        lbh_media_id: pu.receipt_media_id,
        source: "lbh_purchase",
        source_ref: pu.id,
      });
    }
  }

  if (rows.length) {
    // A bulk upsert sends NULL (not the column default) for keys missing in a row: give every row every column.
    const base = {
      fee_cents: 0, status: "confirmed", confirmed_at: null, shop: "", stage_name: null, items: [],
      receipt_source: null, lbh_media_id: null, description: "",
    };
    const full = rows.map((r) => ({ ...base, ...r, shop: (r.shop as string | null) ?? "" }));
    const { error } = await admin
      .from("ba_entries")
      .upsert(full, { onConflict: "owner_id,source,source_ref", ignoreDuplicates: true });
    if (error) console.error(`[build-account] sync: ${error.message}`);
  }
}

export interface BaData {
  accounts: BaAccount[];
  entries: BaEntry[];
  budgets: Record<string, number>;
  stages: string[];
  plan: BaPlan;
  planInfo: { paid_until: string | null; plan: string | null; override: string | null; override_until: string | null } | null;
  priceList: PriceItem[];
  members: { id: string; name: string; email: string | null; whatsapp: string | null; role: string; status: string }[];
  ownerName: string;
  settings: { enabled: boolean; monthly_cents: number | null; yearly_cents: number | null };
  hasBuild: boolean;
}

/** Everything the Build Account screens need, read through the viewer's own access rules. */
export async function loadBa(supabase: SupabaseClient, ctx: BaContext): Promise<BaData> {
  const admin = createAdminClient();
  const [acc, ent, bud, plan, sub, prices, mem, owner, settings, builds] = await Promise.all([
    supabase.from("ba_accounts").select("id, name, kind, holder_member_id").eq("owner_id", ctx.ownerId).order("created_at"),
    supabase
      .from("ba_entries")
      .select("id, account_id, direction, amount_cents, fee_cents, occurred_on, created_at, status, description, shop, service, stage_name, items, receipt_path, receipt_source, source")
      .eq("owner_id", ctx.ownerId)
      .order("occurred_on", { ascending: false })
      .limit(3000),
    supabase.from("ba_budgets").select("stage_name, budget_cents").eq("owner_id", ctx.ownerId),
    supabase.rpc("ba_plan", { p_owner: ctx.ownerId }),
    ctx.isOwner
      ? supabase.from("ba_subscriptions").select("paid_until, plan, override, override_until").eq("owner_id", ctx.ownerId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("price_list").select("id, item, unit, area, price_cents").order("item"),
    ctx.isOwner
      ? supabase.from("ba_members").select("id, name, email, whatsapp, role, status").eq("owner_id", ctx.ownerId).neq("status", "removed").order("created_at")
      : Promise.resolve({ data: [] }),
    admin.from("profiles").select("full_name").eq("id", ctx.ownerId).maybeSingle(),
    admin.from("settings").select("build_account_enabled, build_account_monthly_cents, build_account_yearly_cents").eq("id", 1).single(),
    admin.from("service_requests").select("id").eq("client_id", ctx.ownerId).eq("type", "build").neq("status", "cancelled"),
  ]);

  // Stages: the client's own build stages, else the standard six
  let stages: string[] = DEFAULT_STAGES.map((s) => s.name);
  const buildIds = (builds.data ?? []).map((b) => b.id);
  if (buildIds.length) {
    const { data: bs } = await admin.from("build_stages").select("name, position").in("request_id", buildIds).order("position");
    if (bs?.length) stages = Array.from(new Set(bs.map((s) => s.name)));
  }
  const budgets = Object.fromEntries((bud.data ?? []).map((b) => [b.stage_name, b.budget_cents]));
  const entries = (ent.data ?? []) as BaEntry[];
  for (const extra of [...Object.keys(budgets), ...entries.map((e) => e.stage_name).filter(Boolean)] as string[]) {
    if (!stages.includes(extra)) stages.push(extra);
  }

  return {
    accounts: (acc.data ?? []) as BaAccount[],
    entries,
    budgets,
    stages,
    plan: ((plan.data as string) ?? "none") as BaPlan,
    planInfo: (sub.data as BaData["planInfo"]) ?? null,
    priceList: (prices.data ?? []) as PriceItem[],
    members: (mem.data ?? []) as BaData["members"],
    ownerName: owner.data?.full_name ?? "",
    settings: {
      enabled: settings.data?.build_account_enabled ?? false,
      monthly_cents: settings.data?.build_account_monthly_cents ?? null,
      yearly_cents: settings.data?.build_account_yearly_cents ?? null,
    },
    hasBuild: buildIds.length > 0,
  };
}

/** A paid month/year has been paid: extend the plan from today or the current end. */
export async function confirmBaPaymentByReference(
  merchantReference: string,
  paynowReference?: string | null
): Promise<"confirmed" | "already" | "not_found"> {
  const admin = createAdminClient();
  const { data: pay } = await admin
    .from("ba_payments")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString(), ...(paynowReference ? { paynow_reference: paynowReference } : {}) })
    .eq("merchant_reference", merchantReference)
    .in("status", ["pending", "failed"])
    .select("owner_id, plan")
    .maybeSingle();
  if (!pay) {
    const { data: existing } = await admin.from("ba_payments").select("id").eq("merchant_reference", merchantReference).maybeSingle();
    return existing ? "already" : "not_found";
  }
  const { data: sub } = await admin.from("ba_subscriptions").select("paid_until").eq("owner_id", pay.owner_id).maybeSingle();
  const now = new Date();
  const from = sub?.paid_until && new Date(sub.paid_until) > now ? new Date(sub.paid_until) : now;
  const until = new Date(from);
  if (pay.plan === "yearly") until.setUTCFullYear(until.getUTCFullYear() + 1);
  else until.setUTCMonth(until.getUTCMonth() + 1);
  await admin.from("ba_subscriptions").upsert({
    owner_id: pay.owner_id,
    plan: pay.plan,
    paid_until: until.toISOString(),
    updated_at: now.toISOString(),
  });
  await admin.rpc("log_audit", {
    p_action: "build_account.paid",
    p_entity: "ba_payment",
    p_entity_id: merchantReference,
    p_data: { plan: pay.plan, paid_until: until.toISOString() },
  });
  return "confirmed";
}

export async function failBaPaymentByReference(merchantReference: string): Promise<void> {
  await createAdminClient()
    .from("ba_payments")
    .update({ status: "failed" })
    .eq("merchant_reference", merchantReference)
    .eq("status", "pending");
}

export const REMINDER_DAYS = 5;

/**
 * Renewal reminder: once per paid period, within REMINDER_DAYS of the end
 * (only for paid plans — free plans never expire).
 */
export async function sendRenewalReminders(ownerIds?: string[]): Promise<number> {
  const admin = createAdminClient();
  const soon = new Date(Date.now() + REMINDER_DAYS * 86400000).toISOString();
  let q = admin
    .from("ba_subscriptions")
    .select("owner_id, paid_until, reminded_until, override")
    .gt("paid_until", new Date().toISOString())
    .lt("paid_until", soon);
  if (ownerIds) q = q.in("owner_id", ownerIds);
  const { data: due } = await q;
  let sent = 0;
  for (const s of due ?? []) {
    if (s.override || s.reminded_until === s.paid_until) continue;
    const { data: plan } = await admin.rpc("ba_plan", { p_owner: s.owner_id });
    if (plan !== "paid") continue; // free (full build) never needs renewing
    const { data: hasBuild } = await admin
      .from("service_requests")
      .select("id")
      .eq("client_id", s.owner_id)
      .eq("type", "build")
      .neq("status", "cancelled")
      .limit(1);
    if (hasBuild?.length) continue;
    const { data: p } = await admin.from("profiles").select("email, full_name").eq("id", s.owner_id).single();
    if (!p?.email) continue;
    const end = new Date(s.paid_until).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    await sendEmail({
      to: p.email,
      subject: "LBH Build Account — your plan renews soon",
      text: `Hi ${p.full_name ?? ""},\n\nYour LBH Build Account plan runs until ${end}. Renew in the app to keep adding receipts and money:\n${site.url}/portal/build-account/plans\n\nIf it isn't renewed your Build Account becomes read-only — nothing is ever deleted.\n\nLBH — Let's Build Home`,
    });
    await admin.from("ba_subscriptions").update({ reminded_until: s.paid_until }).eq("owner_id", s.owner_id);
    sent++;
  }
  return sent;
}

export const UNSAVED_RECEIPT_HOURS = 24;

/** Pure: which stored receipt files are unsaved and older than the cut-off. */
export function unsavedReceipts(
  files: { path: string; created_at: string | null }[],
  savedPaths: Set<string>,
  now = Date.now(),
  hours = UNSAVED_RECEIPT_HOURS
): string[] {
  const cutoff = now - hours * 3600_000;
  return files
    .filter((f) => !savedPaths.has(f.path))
    .filter((f) => f.created_at !== null && new Date(f.created_at).getTime() < cutoff)
    .map((f) => f.path);
}

/**
 * Receipt photos are stored as soon as they are read (before "Confirm and
 * deduct"). Delete the ones never saved on a Build Account line after 24 hours.
 */
export async function deleteUnsavedReceipts(): Promise<number> {
  const admin = createAdminClient();
  const bucket = admin.storage.from("documents");
  const page = async (prefix: string) => {
    const out: { name: string; id: string | null; created_at: string | null }[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await bucket.list(prefix, { limit: 1000, offset });
      if (error) throw new Error(`list ${prefix}: ${error.message}`);
      out.push(...(data ?? []));
      if (!data || data.length < 1000) return out;
    }
  };

  let deleted = 0;
  for (const owner of await page("ba")) {
    if (owner.id !== null || !UUID.test(owner.name)) continue; // folders only
    const files = (await page(`ba/${owner.name}`))
      .filter((f) => f.id !== null)
      .map((f) => ({ path: `ba/${owner.name}/${f.name}`, created_at: f.created_at }));
    if (!files.length) continue;
    const { data: saved, error } = await admin
      .from("ba_entries")
      .select("receipt_path")
      .eq("owner_id", owner.name)
      .not("receipt_path", "is", null);
    if (error) continue; // never delete when we can't see what is saved
    const gone = unsavedReceipts(files, new Set((saved ?? []).map((s) => s.receipt_path as string)));
    for (let i = 0; i < gone.length; i += 100) {
      const { error: rmErr } = await bucket.remove(gone.slice(i, i + 100));
      if (!rmErr) deleted += Math.min(100, gone.length - i);
    }
  }
  return deleted;
}
