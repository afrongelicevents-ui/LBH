"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserProfile } from "@/lib/supabase/server";
import {
  parseUploadRefs,
  storePrivate,
  takeIncoming,
  uploadErrorCode,
  type UploadedRef,
} from "@/lib/uploads";
import { initiatePaynowPayment } from "@/lib/paynow";
import { rateLimited } from "@/lib/ratelimit";
import { site } from "@/config/site";

export type ActionResult = { ok: true; id?: string; warning?: string } | { ok: false; error: string };

async function requireClient() {
  const { supabase, user, profile } = await getUserProfile();
  if (!user || !profile || profile.role !== "client") {
    throw new Error("not authorised");
  }
  return { supabase, user, profile };
}

/**
 * Claim files the browser uploaded directly to storage and attach them to
 * the request (images re-encoded, EXIF stripped, real type checked).
 */
async function storeRequestDocuments(
  requestId: string,
  userId: string,
  refs: UploadedRef[],
  supabase: Awaited<ReturnType<typeof requireClient>>["supabase"]
) {
  for (const ref of refs.slice(0, 10)) {
    const f = await takeIncoming(userId, ref, "client-document");
    const path = await storePrivate("documents", `requests/${requestId}`, f.buffer, f.contentType, f.ext);
    const { error } = await supabase.from("documents").insert({
      request_id: requestId,
      uploader_id: userId,
      storage_path: path,
      file_name: f.originalName || `document.${f.ext}`,
      kind: "client_document",
    });
    if (error) throw new Error(error.message);
  }
}

// ---------- land verification request (brief §5.2) ----------
/** Optional number field: "" (not filled in) stays empty instead of becoming 0. */
const optNum = (min: number, max: number) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.coerce.number().min(min).max(max).optional()
  );

const landSchema = z.object({
  town: z.string().trim().min(2).max(120),
  stand_number: z.string().trim().min(1).max(60),
  pin_lat: optNum(-90, 90),
  pin_lng: optNum(-180, 180),
  introduced_by: z.string().trim().max(500).default(""),
  told_about: z.string().trim().max(2000).default(""),
});

export async function createLandRequest(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireClient();
    if (await rateLimited("new-request", 10, 3600)) {
      return { ok: false, error: "rate" };
    }
    const parsed = landSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { ok: false, error: "invalid" };
    const d = parsed.data;

    const { data: req, error } = await supabase
      .from("service_requests")
      .insert({
        client_id: user.id,
        type: "land_verification",
        status: "new",
        title: `${d.stand_number}, ${d.town}`,
        details: {
          town: d.town,
          stand_number: d.stand_number,
          // a pin needs both coordinates
          pin_lat: d.pin_lat !== undefined && d.pin_lng !== undefined ? d.pin_lat : null,
          pin_lng: d.pin_lat !== undefined && d.pin_lng !== undefined ? d.pin_lng : null,
          introduced_by: d.introduced_by,
          told_about: d.told_about,
        },
      })
      .select("id")
      .single();
    if (error || !req) return { ok: false, error: "db" };

    // The request exists now: a document problem must not make the client
    // send it again (that would create a duplicate request).
    let warning: string | undefined;
    try {
      await storeRequestDocuments(req.id, user.id, parseUploadRefs(formData.get("uploads_json")), supabase);
    } catch (e) {
      console.error(`[land-request docs] ${e instanceof Error ? e.message : e}`);
      warning = "docs";
    }

    revalidatePath("/[locale]/account", "layout");
    return { ok: true, id: req.id, warning };
  } catch (e) {
    console.error(`[land-request] ${e instanceof Error ? e.message : e}`);
    return { ok: false, error: uploadErrorCode(e) };
  }
}

// ---------- materials request (brief §5.2) ----------
const materialsSchema = z.object({
  site_address: z.string().trim().min(3).max(300),
  items_json: z.string().max(20000),
  needed_by: z.string().trim().max(30).default(""),
  delivery_instructions: z.string().trim().max(2000).default(""),
});

const itemsSchema = z
  .array(
    z.object({
      item: z.string().trim().min(1).max(200),
      quantity: z.string().trim().min(1).max(60),
      notes: z.string().trim().max(300).default(""),
    })
  )
  .min(1)
  .max(100);

export async function createMaterialsRequest(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireClient();
    if (await rateLimited("new-request", 10, 3600)) {
      return { ok: false, error: "rate" };
    }
    const parsed = materialsSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { ok: false, error: "invalid" };
    const d = parsed.data;

    let items: z.infer<typeof itemsSchema>;
    try {
      items = itemsSchema.parse(JSON.parse(d.items_json));
    } catch {
      return { ok: false, error: "invalid" };
    }

    const { data: req, error } = await supabase
      .from("service_requests")
      .insert({
        client_id: user.id,
        type: "materials",
        status: "new",
        title: `Materials — ${d.site_address.slice(0, 80)}`,
        details: {
          site_address: d.site_address,
          items,
          needed_by: d.needed_by,
          delivery_instructions: d.delivery_instructions,
        },
      })
      .select("id")
      .single();
    if (error || !req) return { ok: false, error: "db" };

    let warning: string | undefined;
    try {
      await storeRequestDocuments(req.id, user.id, parseUploadRefs(formData.get("uploads_json")), supabase);
    } catch (e) {
      console.error(`[materials-request docs] ${e instanceof Error ? e.message : e}`);
      warning = "docs";
    }

    revalidatePath("/[locale]/account", "layout");
    return { ok: true, id: req.id, warning };
  } catch (e) {
    console.error(`[materials-request] ${e instanceof Error ? e.message : e}`);
    return { ok: false, error: uploadErrorCode(e) };
  }
}

// ---------- quote acceptance: RPC records name + timestamp ----------
export async function acceptQuoteAction(quoteId: string, locale: string): Promise<ActionResult> {
  let requestId: string;
  try {
    const { supabase } = await requireClient();
    const { data: q } = await supabase.from("quotes").select("request_id").eq("id", quoteId).maybeSingle();
    if (!q) return { ok: false, error: "invalid" };
    requestId = q.request_id;
    const { error } = await supabase.rpc("accept_quote", { p_quote_id: quoteId });
    if (error) {
      console.error(`[accept-quote] ${error.message}`);
      return { ok: false, error: "db" };
    }
  } catch {
    return { ok: false, error: "error" };
  }
  revalidatePath("/[locale]/account", "layout");
  // Straight to the request, where the deposit can now be paid.
  const prefix = locale === "en" ? "" : `/${locale}`;
  redirect(`${prefix}/account/projects/${requestId}?accepted=1#payments`);
}

// ---------- extra-cost approval decision ----------
export async function decideApprovalAction(
  approvalId: string,
  approve: boolean
): Promise<ActionResult> {
  try {
    const { supabase } = await requireClient();
    const { error } = await supabase.rpc("decide_approval", {
      p_approval_id: approvalId,
      p_approve: approve,
    });
    if (error) return { ok: false, error: "db" };
    revalidatePath("/[locale]/account", "layout");
    return { ok: true };
  } catch {
    return { ok: false, error: "error" };
  }
}

// ---------- supplier quote approval (materials) ----------
export async function approveSupplierQuoteAction(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireClient();
    const { error } = await supabase.rpc("approve_supplier_quote", { p_id: id });
    if (error) return { ok: false, error: "db" };
    revalidatePath("/[locale]/account", "layout");
    return { ok: true };
  } catch {
    return { ok: false, error: "error" };
  }
}

// ---------- payments ----------
/** Start an online payment (Paynow, or the simulated test checkout). */
export async function startPayment(paymentId: string, locale: string): Promise<ActionResult> {
  let ctx: Awaited<ReturnType<typeof requireClient>>;
  try {
    ctx = await requireClient();
  } catch {
    return { ok: false, error: "auth" };
  }
  const { supabase, profile } = ctx;

  // RLS limits this to the client's own payments.
  const { data: payment } = await supabase
    .from("payments")
    .select("id, status, amount_cents, merchant_reference, method")
    .eq("id", paymentId)
    .single();
  if (!payment || !["pending", "failed"].includes(payment.status)) {
    return { ok: false, error: "closed" };
  }

  let result: Awaited<ReturnType<typeof initiatePaynowPayment>>;
  try {
    result = await initiatePaynowPayment({
      merchantReference: payment.merchant_reference,
      amountCents: payment.amount_cents,
      email: profile.email,
      returnUrl: `${site.url}/${locale}/pay/return?ref=${encodeURIComponent(payment.merchant_reference)}`,
    });
  } catch (e) {
    console.error(`[pay] ${e instanceof Error ? e.message : e}`);
    return { ok: false, error: "paynow" };
  }

  if (!result.simulated) {
    // Payment updates are admin-only under RLS; ownership was verified above
    // by reading the row through the client's own RLS-bound session.
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    await admin
      .from("payments")
      .update({ paynow_poll_url: result.pollUrl, method: "paynow" })
      .eq("id", payment.id);
    redirect(result.redirectUrl);
  }
  redirect(`/${locale}/pay/simulate?ref=${encodeURIComponent(payment.merchant_reference)}`);
}

const proofSchema = z.object({
  reference: z.string().trim().min(2).max(200),
});

/** "I paid via Remitly / WorldRemit / bank transfer" → proof + reference. */
export async function submitManualProof(
  paymentId: string,
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireClient();
    const parsed = proofSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { ok: false, error: "invalid" };

    const { data: payment } = await supabase
      .from("payments")
      .select("id, status, request_id")
      .eq("id", paymentId)
      .single();
    if (!payment || !["pending", "failed"].includes(payment.status)) {
      return { ok: false, error: "closed" };
    }

    const [ref] = parseUploadRefs(formData.get("uploads_json"));
    if (!ref) return { ok: false, error: "invalid" };
    const f = await takeIncoming(user.id, ref, "client-document");
    const path = await storePrivate("proofs", `payments/${payment.id}`, f.buffer, f.contentType, f.ext);

    // Status change is admin-gated by RLS → service role, scoped to this row.
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const { error } = await admin
      .from("payments")
      .update({
        method: "manual",
        status: "submitted",
        proof_path: path,
        proof_reference: parsed.data.reference,
      })
      .eq("id", payment.id)
      .in("status", ["pending", "failed"]);
    if (error) return { ok: false, error: "db" };

    await admin.rpc("log_audit", {
      p_action: "payment.proof_submitted",
      p_entity: "payment",
      p_entity_id: payment.id,
      p_data: { by: user.id, reference: parsed.data.reference },
    });

    revalidatePath("/[locale]/account", "layout");
    return { ok: true };
  } catch (e) {
    console.error(`[manual-proof] ${e instanceof Error ? e.message : e}`);
    return { ok: false, error: uploadErrorCode(e) };
  }
}
