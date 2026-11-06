"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserProfile } from "@/lib/supabase/server";
import {
  DOC_TYPES,
  MAX_DOC_BYTES,
  extForType,
  reencodeImage,
  storePrivate,
  IMAGE_TYPES,
} from "@/lib/uploads";
import { initiatePaynowPayment } from "@/lib/paynow";
import { rateLimited } from "@/lib/ratelimit";
import { site } from "@/config/site";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

async function requireClient() {
  const { supabase, user, profile } = await getUserProfile();
  if (!user || !profile || profile.role !== "client") {
    throw new Error("not authorised");
  }
  return { supabase, user, profile };
}

/** Store validated uploads for a request; images are re-encoded (EXIF stripped). */
async function storeRequestDocuments(
  requestId: string,
  userId: string,
  files: File[],
  supabase: Awaited<ReturnType<typeof requireClient>>["supabase"]
) {
  for (const file of files.slice(0, 10)) {
    if (!file.size) continue;
    if (!DOC_TYPES.includes(file.type) || file.size > MAX_DOC_BYTES) {
      throw new Error("invalid file");
    }
    let buffer: Buffer = Buffer.from(await file.arrayBuffer());
    let contentType = file.type;
    let ext = extForType(file.type);
    if (IMAGE_TYPES.includes(file.type)) {
      buffer = await reencodeImage(buffer);
      contentType = "image/jpeg";
      ext = "jpg";
    }
    const path = await storePrivate(
      "documents",
      `requests/${requestId}`,
      buffer,
      contentType,
      ext
    );
    const { error } = await supabase.from("documents").insert({
      request_id: requestId,
      uploader_id: userId,
      storage_path: path,
      file_name: file.name.slice(0, 200),
      kind: "client_document",
    });
    if (error) throw new Error(error.message);
  }
}

// ---------- land verification request (brief §5.2) ----------
const landSchema = z.object({
  town: z.string().trim().min(2).max(120),
  stand_number: z.string().trim().min(1).max(60),
  pin_lat: z.coerce.number().min(-90).max(90).optional().or(z.literal("")),
  pin_lng: z.coerce.number().min(-180).max(180).optional().or(z.literal("")),
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
          pin_lat: d.pin_lat === "" ? null : d.pin_lat,
          pin_lng: d.pin_lng === "" ? null : d.pin_lng,
          introduced_by: d.introduced_by,
          told_about: d.told_about,
        },
      })
      .select("id")
      .single();
    if (error || !req) return { ok: false, error: "db" };

    const files = formData.getAll("documents").filter((f): f is File => f instanceof File);
    await storeRequestDocuments(req.id, user.id, files, supabase);

    revalidatePath("/[locale]/portal", "layout");
    return { ok: true, id: req.id };
  } catch (e) {
    console.error(`[land-request] ${e instanceof Error ? e.message : e}`);
    return { ok: false, error: "error" };
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

    const files = formData.getAll("documents").filter((f): f is File => f instanceof File);
    await storeRequestDocuments(req.id, user.id, files, supabase);

    revalidatePath("/[locale]/portal", "layout");
    return { ok: true, id: req.id };
  } catch (e) {
    console.error(`[materials-request] ${e instanceof Error ? e.message : e}`);
    return { ok: false, error: "error" };
  }
}

// ---------- quote acceptance: RPC records name + timestamp ----------
export async function acceptQuoteAction(quoteId: string, locale: string) {
  const { supabase } = await requireClient();
  const { error } = await supabase.rpc("accept_quote", { p_quote_id: quoteId });
  if (error) {
    console.error(`[accept-quote] ${error.message}`);
    throw new Error("accept failed");
  }
  revalidatePath("/[locale]/portal", "layout");
  redirect(`/${locale}/portal`);
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
    revalidatePath("/[locale]/portal", "layout");
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
    revalidatePath("/[locale]/portal", "layout");
    return { ok: true };
  } catch {
    return { ok: false, error: "error" };
  }
}

// ---------- payments ----------
/** Start an online payment (Paynow, or the simulated test checkout). */
export async function startPayment(paymentId: string, locale: string) {
  const { supabase, profile } = await requireClient();

  // RLS limits this to the client's own payments.
  const { data: payment } = await supabase
    .from("payments")
    .select("id, status, amount_cents, merchant_reference, method")
    .eq("id", paymentId)
    .single();
  if (!payment || !["pending", "failed"].includes(payment.status)) {
    throw new Error("payment not open");
  }

  const result = await initiatePaynowPayment({
    merchantReference: payment.merchant_reference,
    amountCents: payment.amount_cents,
    email: profile.email,
    returnUrl: `${site.url}/${locale}/pay/return?ref=${encodeURIComponent(payment.merchant_reference)}`,
  });

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

    const file = formData.get("proof");
    if (!(file instanceof File) || !file.size) return { ok: false, error: "invalid" };
    if (!DOC_TYPES.includes(file.type) || file.size > MAX_DOC_BYTES) {
      return { ok: false, error: "invalid" };
    }
    let buffer: Buffer = Buffer.from(await file.arrayBuffer());
    let contentType = file.type;
    let ext = extForType(file.type);
    if (IMAGE_TYPES.includes(file.type)) {
      buffer = await reencodeImage(buffer);
      contentType = "image/jpeg";
      ext = "jpg";
    }
    const path = await storePrivate(
      "proofs",
      `payments/${payment.id}`,
      buffer,
      contentType,
      ext
    );

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

    revalidatePath("/[locale]/portal", "layout");
    return { ok: true };
  } catch (e) {
    console.error(`[manual-proof] ${e instanceof Error ? e.message : e}`);
    return { ok: false, error: "error" };
  }
}
