"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getUserProfile } from "@/lib/supabase/server";
import { parseDollarsToCents } from "@/lib/money";
import { sendEmail } from "@/lib/email";
import { site } from "@/config/site";
import { DEFAULT_STAGES } from "@/lib/stages";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  captureProvenance,
  discardIncoming,
  parseUploadRefs,
  storePrivate,
  storeQuoteFile,
  takeIncoming,
  uploadErrorCode,
  type UploadedRef,
} from "@/lib/uploads";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Id made on the phone for one offline save (replays are stored once). */
function clientRefFrom(formData: FormData): string | null {
  const v = formData.get("client_ref");
  return typeof v === "string" && UUID_RE.test(v) ? v : null;
}

/**
 * Construction build stages. The database enforces every rule (order of
 * steps, who may do what, buyer ≠ inspector) — these actions add input
 * validation, role checks and friendly errors on top.
 */

export type StageResult = { ok: true; id?: string } | { ok: false; error: string };

function revalidateAll() {
  revalidatePath("/[locale]/account", "layout");
  revalidatePath("/[locale]/admin", "layout");
  revalidatePath("/[locale]/field", "layout");
}

/** Map database rule violations to short codes the UI can translate. */
function dbErrorCode(message: string | undefined): string {
  const m = message ?? "";
  if (m === "not authorised") return "auth";
  if (/bought this stage/.test(m)) return "buyerCannotInspect";
  if (/currently quoting/.test(m)) return "stageLocked";
  if (/client has paid/.test(m)) return "notPaid";
  if (/delivery photo/.test(m)) return "needDeliveryPhoto";
  if (/inspection photo/.test(m)) return "needInspectionPhoto";
  if (/materials used/.test(m)) return "needMaterials";
  if (/not started can be/.test(m)) return "stageStarted";
  if (/approved stage cannot/.test(m)) return "stageApproved";
  if (/one step at a time|not ready|not open|its own action|earlier stages/.test(m)) return "wrongStep";
  return "db";
}

async function requireStaff() {
  const { supabase, user, profile, aal } = await getUserProfile();
  if (!user || !profile || !["admin", "field"].includes(profile.role) || aal !== "aal2") {
    throw new Error("not authorised");
  }
  return { supabase, user, profile };
}

async function requireAdmin() {
  const ctx = await requireStaff();
  if (ctx.profile.role !== "admin") throw new Error("not authorised");
  return ctx;
}

async function requireClient() {
  const { supabase, user, profile } = await getUserProfile();
  if (!user || !profile || profile.role !== "client") throw new Error("not authorised");
  return { supabase, user, profile };
}

// ======================================================================
// Client
// ======================================================================

export async function approveStageQuoteAction(quoteId: string): Promise<StageResult> {
  try {
    const { supabase } = await requireClient();
    const { error } = await supabase.rpc("approve_stage_quote", { p_quote_id: quoteId });
    if (error) return { ok: false, error: dbErrorCode(error.message) };
    revalidateAll();
    return { ok: true };
  } catch {
    return { ok: false, error: "auth" };
  }
}

export async function approveStageAction(stageId: string): Promise<StageResult> {
  try {
    const { supabase } = await requireClient();
    const { error } = await supabase.rpc("approve_stage", { p_stage_id: stageId });
    if (error) return { ok: false, error: dbErrorCode(error.message) };
    revalidateAll();
    return { ok: true };
  } catch {
    return { ok: false, error: "auth" };
  }
}

// ======================================================================
// Staff (admin or assigned field staff, 2FA)
// ======================================================================

type StaffCtx = Awaited<ReturnType<typeof requireStaff>>;

/** Claim browser-uploaded files and attach them to a stage as media rows. */
async function attachStageMedia(
  ctx: StaffCtx,
  stageId: string,
  kind: "receipt" | "delivery" | "progress" | "inspection",
  refs: UploadedRef[],
  extra: { note?: string; amountCents?: number | null } = {}
): Promise<string[]> {
  const ids: string[] = [];
  // Field staff: in-app camera only (no gallery uploads).
  const requireCamera = ctx.profile.role === "field";
  for (const ref of refs.slice(0, 10)) {
    // Replayed after a dropped connection? Reuse the stored file.
    if (ref.clientRef) {
      const { data: dup } = await createAdminClient()
        .from("media")
        .select("id")
        .eq("client_ref", ref.clientRef)
        .eq("uploader_id", ctx.user.id)
        .maybeSingle();
      if (dup) {
        await discardIncoming(ctx.user.id, [ref]);
        ids.push(dup.id);
        continue;
      }
    }
    const f = await takeIncoming(ctx.user.id, ref, "staff-media");
    if (!f.isImage && kind === "receipt") throw new Error("invalid file type");
    const prov = captureProvenance(ref, f.exif, { requireCamera });
    const path = await storePrivate("media", `stages/${stageId}`, f.buffer, f.contentType, f.ext);
    const { data, error } = await ctx.supabase
      .from("media")
      .insert({
        stage_id: stageId,
        request_id: "00000000-0000-0000-0000-000000000000", // pinned by trigger
        uploader_id: ctx.user.id,
        kind: f.isImage || kind === "receipt" ? kind : "progress",
        storage_path: path,
        original_name: f.originalName,
        taken_at: prov.takenAt,
        gps_lat: prov.gpsLat,
        gps_lng: prov.gpsLng,
        gps_accuracy_m: prov.accuracy,
        capture_source: prov.source,
        client_ref: ref.clientRef ?? null,
        amount_cents: extra.amountCents ?? null,
        note: extra.note ?? "",
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "media insert failed");
    ids.push(data.id);
  }
  return ids;
}

const noteSchema = z.string().trim().max(1000).default("");

export async function addStagePhotos(
  stageId: string,
  kind: "delivery" | "progress" | "inspection",
  _prev: StageResult | null,
  formData: FormData
): Promise<StageResult> {
  try {
    const ctx = await requireStaff();
    if (!["delivery", "progress", "inspection"].includes(kind)) return { ok: false, error: "invalid" };
    const refs = parseUploadRefs(formData.get("uploads_json"));
    if (refs.length === 0) return { ok: false, error: "invalid" };
    const note = noteSchema.parse(formData.get("note") ?? "");
    await attachStageMedia(ctx, stageId, kind, refs, { note });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    console.error(`[stage-photos] ${e instanceof Error ? e.message : e}`);
    const code = uploadErrorCode(e);
    return { ok: false, error: code === "error" ? dbErrorCode((e as Error)?.message) : code };
  }
}

const purchaseSchema = z.object({
  supplier_name: z.string().trim().min(2).max(200),
  amount: z.string().trim().min(1).max(20),
  note: z.string().trim().max(1000).default(""),
});

export async function recordPurchase(
  stageId: string,
  _prev: StageResult | null,
  formData: FormData
): Promise<StageResult> {
  try {
    const ctx = await requireStaff();
    const parsed = purchaseSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { ok: false, error: "invalid" };
    const cents = parseDollarsToCents(parsed.data.amount);
    if (cents === null) return { ok: false, error: "invalid" };
    const refs = parseUploadRefs(formData.get("uploads_json"));
    if (refs.length === 0) return { ok: false, error: "needReceipt" };

    const clientRef = clientRefFrom(formData);
    if (clientRef) {
      const { data: dup } = await createAdminClient()
        .from("stage_purchases")
        .select("id")
        .eq("client_ref", clientRef)
        .maybeSingle();
      if (dup) {
        await discardIncoming(ctx.user.id, refs);
        return { ok: true };
      }
    }

    // Check the stage is open for buying BEFORE storing the receipt.
    const { data: stage } = await ctx.supabase
      .from("build_stages")
      .select("status")
      .eq("id", stageId)
      .single();
    if (!stage || !["paid", "purchased"].includes(stage.status)) {
      return { ok: false, error: "notPaid" };
    }

    const [receiptId] = await attachStageMedia(ctx, stageId, "receipt", refs.slice(0, 1), {
      amountCents: cents,
      note: parsed.data.supplier_name,
    });
    const { error } = await ctx.supabase.from("stage_purchases").insert({
      stage_id: stageId,
      request_id: "00000000-0000-0000-0000-000000000000", // pinned by trigger
      purchased_by: ctx.user.id,
      supplier_name: parsed.data.supplier_name,
      amount_cents: cents,
      receipt_media_id: receiptId,
      note: parsed.data.note,
      client_ref: clientRef,
    });
    if (error) {
      if (error.code === "23505") return { ok: true };
      return { ok: false, error: dbErrorCode(error.message) };
    }
    revalidateAll();
    return { ok: true };
  } catch (e) {
    console.error(`[stage-purchase] ${e instanceof Error ? e.message : e}`);
    const code = uploadErrorCode(e);
    return { ok: false, error: code === "error" ? dbErrorCode((e as Error)?.message) : code };
  }
}

export async function advanceStage(
  stageId: string,
  to: "delivered" | "building"
): Promise<StageResult> {
  try {
    const ctx = await requireStaff();
    if (!["delivered", "building"].includes(to)) return { ok: false, error: "invalid" };
    const { error } = await ctx.supabase.rpc("advance_stage_work", { p_stage_id: stageId, p_to: to });
    if (error) return { ok: false, error: dbErrorCode(error.message) };
    revalidateAll();
    return { ok: true };
  } catch {
    return { ok: false, error: "auth" };
  }
}

const inspectionSchema = z.object({
  notes: z.string().trim().min(3).max(4000),
  materials: z.string().trim().min(2).max(4000),
});

/** "Cement 42.5N — 60 bags" per line → [{item, quantity}] */
function parseMaterials(text: string) {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 100)
    .map((line) => {
      const [item, ...rest] = line.split(/\s+[—–-]\s+|:\s+/);
      return { item: item.slice(0, 200), quantity: rest.join(" ").slice(0, 100) };
    });
}

export async function submitInspection(
  stageId: string,
  _prev: StageResult | null,
  formData: FormData
): Promise<StageResult> {
  try {
    const ctx = await requireStaff();
    const parsed = inspectionSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { ok: false, error: "needMaterials" };
    const materials = parseMaterials(parsed.data.materials);
    if (materials.length === 0) return { ok: false, error: "needMaterials" };

    const clientRef = clientRefFrom(formData);
    if (clientRef) {
      const { data: dup } = await createAdminClient()
        .from("stage_inspections")
        .select("id")
        .eq("client_ref", clientRef)
        .maybeSingle();
      if (dup) {
        await discardIncoming(ctx.user.id, parseUploadRefs(formData.get("uploads_json")));
        return { ok: true };
      }
    }

    // The buyer can never inspect — check before storing photos.
    const { data: bought } = await ctx.supabase
      .from("stage_purchases")
      .select("id")
      .eq("stage_id", stageId)
      .eq("purchased_by", ctx.user.id)
      .limit(1);
    if (bought && bought.length > 0) return { ok: false, error: "buyerCannotInspect" };

    const refs = parseUploadRefs(formData.get("uploads_json"));
    if (refs.length > 0) {
      await attachStageMedia(ctx, stageId, "inspection", refs);
    }
    const { error } = await ctx.supabase.from("stage_inspections").insert({
      stage_id: stageId,
      request_id: "00000000-0000-0000-0000-000000000000", // pinned by trigger
      inspector_id: ctx.user.id,
      notes: parsed.data.notes,
      materials_used: materials,
      client_ref: clientRef,
    });
    if (error) {
      if (error.code === "23505") return { ok: true };
      return { ok: false, error: dbErrorCode(error.message) };
    }

    // Tell the client their approval is needed
    const { data: st } = await ctx.supabase
      .from("build_stages")
      .select("name, request_id")
      .eq("id", stageId)
      .single();
    if (st) {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const { data: req } = await createAdminClient()
        .from("service_requests")
        .select("title, profiles:client_id(email, full_name)")
        .eq("id", st.request_id)
        .single();
      const client = req?.profiles as unknown as { email?: string; full_name?: string } | null;
      if (client?.email) {
        await sendEmail({
          to: client.email,
          subject: `LBH — ${st.name} inspected: your approval is needed`,
          text: `Hi ${client.full_name ?? ""},\n\nWe inspected the ${st.name} stage of "${req?.title}". See the photos and the materials used, then tap "Approve stage" in your portal to unlock the next stage:\n${site.url}\n\nLBH — Let's Build Home`,
        });
      }
    }
    revalidateAll();
    return { ok: true };
  } catch (e) {
    console.error(`[stage-inspection] ${e instanceof Error ? e.message : e}`);
    const code = uploadErrorCode(e);
    return { ok: false, error: code === "error" ? dbErrorCode((e as Error)?.message) : code };
  }
}

// ======================================================================
// Admin
// ======================================================================

const createBuildSchema = z.object({
  client_id: z.string().uuid(),
  title: z.string().trim().min(3).max(150),
  site_address: z.string().trim().min(3).max(300),
  staff_id: z.string().uuid().optional().or(z.literal("")),
});

export async function createBuild(
  _prev: StageResult | null,
  formData: FormData
): Promise<StageResult> {
  try {
    const { supabase, user } = await requireAdmin();
    const parsed = createBuildSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { ok: false, error: "invalid" };
    const d = parsed.data;

    const { data: client } = await supabase
      .from("profiles")
      .select("id, role, email, full_name")
      .eq("id", d.client_id)
      .single();
    if (!client || client.role !== "client") return { ok: false, error: "invalid" };

    const { data: req, error } = await supabase
      .from("service_requests")
      .insert({
        client_id: d.client_id,
        type: "build",
        status: "on_site",
        title: d.title,
        details: { site_address: d.site_address },
      })
      .select("id")
      .single();
    if (error || !req) return { ok: false, error: "db" };

    const { error: stErr } = await supabase.from("build_stages").insert(
      DEFAULT_STAGES.map((s, i) => ({
        request_id: req.id,
        position: i + 1,
        name: s.name,
        description: s.description,
      }))
    );
    if (stErr) return { ok: false, error: "db" };

    if (d.staff_id) {
      const { data: staff } = await supabase.from("profiles").select("role").eq("id", d.staff_id).single();
      if (staff?.role === "field") {
        await supabase.from("jobs").insert({ request_id: req.id, assigned_to: d.staff_id, created_by: user.id });
      }
    }
    const { error: startErr } = await supabase.rpc("start_build", { p_request_id: req.id });
    if (startErr) return { ok: false, error: dbErrorCode(startErr.message) };

    await sendEmail({
      to: client.email,
      subject: "LBH — your build project is set up",
      text: `Hi ${client.full_name},\n\nYour build "${d.title}" is set up in your LBH portal under "My build". We'll add supplier quotes for the first stage soon — nothing is bought until you approve.\n${site.url}\n\nLBH — Let's Build Home`,
    });
    revalidateAll();
    return { ok: true, id: req.id };
  } catch {
    return { ok: false, error: "auth" };
  }
}

const quoteSchema = z.object({
  supplier_name: z.string().trim().min(2).max(200),
  amount: z.string().trim().min(1).max(20),
  items: z.string().trim().max(4000).default(""),
});

export async function addStageQuote(
  stageId: string,
  _prev: StageResult | null,
  formData: FormData
): Promise<StageResult> {
  try {
    const { supabase, user } = await requireAdmin();
    const parsed = quoteSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { ok: false, error: "invalid" };
    const cents = parseDollarsToCents(parsed.data.amount);
    if (!cents) return { ok: false, error: "invalid" };
    const { data: stage } = await supabase
      .from("build_stages")
      .select("request_id, status")
      .eq("id", stageId)
      .single();
    if (!stage) return { ok: false, error: "invalid" };
    if (stage.status !== "quoting") return { ok: false, error: "stageLocked" };
    // Optional: photo/PDF of the supplier's own quote
    const [ref] = parseUploadRefs(formData.get("uploads_json"));
    const filePath = ref ? await storeQuoteFile(user.id, ref, stage.request_id) : null;
    const { error } = await supabase.from("stage_quotes").insert({
      stage_id: stageId,
      request_id: "00000000-0000-0000-0000-000000000000", // pinned by trigger
      supplier_name: parsed.data.supplier_name,
      amount_cents: cents,
      items: parsed.data.items,
      file_path: filePath,
    });
    if (error) return { ok: false, error: dbErrorCode(error.message) };
    revalidateAll();
    return { ok: true };
  } catch (e) {
    const code = uploadErrorCode(e);
    return { ok: false, error: code === "error" ? dbErrorCode((e as Error)?.message) : code };
  }
}

/** Admin: attach (or replace) the supplier's quote file on an existing quote. */
export async function attachQuoteFile(
  kind: "stage" | "supplier",
  quoteId: string,
  _prev: StageResult | null,
  formData: FormData
): Promise<StageResult> {
  try {
    const { supabase, user } = await requireAdmin();
    if (!UUID_RE.test(quoteId) || !["stage", "supplier"].includes(kind)) return { ok: false, error: "invalid" };
    const table = kind === "stage" ? "stage_quotes" : "supplier_quotes";
    const { data: quote } = await supabase.from(table).select("id, request_id").eq("id", quoteId).single();
    if (!quote) return { ok: false, error: "invalid" };
    const [ref] = parseUploadRefs(formData.get("uploads_json"));
    if (!ref) return { ok: false, error: "invalid" };
    const filePath = await storeQuoteFile(user.id, ref, quote.request_id);
    const { error } = await supabase.from(table).update({ file_path: filePath }).eq("id", quoteId);
    if (error) return { ok: false, error: "db" };
    await supabase.rpc("admin_log_audit", {
      p_action: "quote.file_attached",
      p_entity: table,
      p_entity_id: quoteId,
      p_data: {},
    });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    const code = uploadErrorCode(e);
    return { ok: false, error: code === "error" ? dbErrorCode((e as Error)?.message) : code };
  }
}

const stageEditSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(1000).default(""),
});

export async function updateStage(
  stageId: string,
  _prev: StageResult | null,
  formData: FormData
): Promise<StageResult> {
  try {
    const { supabase } = await requireAdmin();
    const parsed = stageEditSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { ok: false, error: "invalid" };
    const { error } = await supabase.from("build_stages").update(parsed.data).eq("id", stageId);
    if (error) return { ok: false, error: dbErrorCode(error.message) };
    revalidateAll();
    return { ok: true };
  } catch {
    return { ok: false, error: "auth" };
  }
}

export async function addStage(
  requestId: string,
  _prev: StageResult | null,
  formData: FormData
): Promise<StageResult> {
  try {
    const { supabase } = await requireAdmin();
    const parsed = stageEditSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { ok: false, error: "invalid" };
    const { data: last } = await supabase
      .from("build_stages")
      .select("position")
      .eq("request_id", requestId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error } = await supabase.from("build_stages").insert({
      request_id: requestId,
      position: (last?.position ?? 0) + 1,
      ...parsed.data,
    });
    if (error) return { ok: false, error: dbErrorCode(error.message) };
    revalidateAll();
    return { ok: true };
  } catch {
    return { ok: false, error: "auth" };
  }
}

export async function deleteStage(stageId: string): Promise<StageResult> {
  try {
    const { supabase } = await requireAdmin();
    const { data, error } = await supabase.from("build_stages").delete().eq("id", stageId).select("id");
    if (error) return { ok: false, error: dbErrorCode(error.message) };
    if (!data?.length) return { ok: false, error: "stageStarted" };
    revalidateAll();
    return { ok: true };
  } catch {
    return { ok: false, error: "auth" };
  }
}

export async function moveStage(stageId: string, dir: -1 | 1): Promise<StageResult> {
  try {
    const { supabase } = await requireAdmin();
    const { error } = await supabase.rpc("move_stage", { p_stage_id: stageId, p_dir: dir < 0 ? -1 : 1 });
    if (error) return { ok: false, error: dbErrorCode(error.message) };
    revalidateAll();
    return { ok: true };
  } catch {
    return { ok: false, error: "auth" };
  }
}
