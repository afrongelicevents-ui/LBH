import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";

/**
 * Money state machine (brief §10). All transitions are idempotent: the
 * UPDATE is guarded by the current status, so a replayed webhook or a
 * double-click cannot double-confirm or double-ledger a payment.
 */

export async function confirmPaymentByReference(
  merchantReference: string,
  opts: { confirmedBy?: string | null; viaWebhook?: boolean; paynowReference?: string | null }
): Promise<"confirmed" | "already" | "not_found"> {
  const admin = createAdminClient();

  const { data: updated, error } = await admin
    .from("payments")
    .update({
      status: "confirmed",
      confirmed_by: opts.confirmedBy ?? null,
      confirmed_at: new Date().toISOString(),
      ...(opts.paynowReference ? { paynow_reference: opts.paynowReference } : {}),
    })
    .eq("merchant_reference", merchantReference)
    .in("status", ["pending", "submitted"])
    .select("id, request_id, kind, amount_cents, quote_id, stage_id")
    .maybeSingle();

  if (error) {
    console.error(`[payments] confirm failed: ${error.message}`);
    return "not_found";
  }
  if (!updated) {
    const { data: existing } = await admin
      .from("payments")
      .select("id, status")
      .eq("merchant_reference", merchantReference)
      .maybeSingle();
    return existing ? "already" : "not_found";
  }

  await admin.from("ledger_entries").insert({
    payment_id: updated.id,
    request_id: updated.request_id,
    amount_cents: updated.amount_cents,
    direction: "in",
    note: `${updated.kind} payment confirmed (${merchantReference})`,
    created_by: opts.confirmedBy ?? null,
  });

  // Advance the request timeline
  if (updated.kind === "deposit") {
    await admin
      .from("service_requests")
      .update({ status: "deposit_paid" })
      .eq("id", updated.request_id)
      .in("status", ["accepted", "quote_sent"]);
  } else if (updated.kind === "balance") {
    await admin
      .from("service_requests")
      .update({ status: "balance_paid" })
      .eq("id", updated.request_id)
      .eq("status", "report_ready");
  }

  // Materials for a build stage: paid → LBH may now buy them
  if (updated.kind === "materials" && updated.stage_id) {
    const { error: stageErr } = await admin
      .from("build_stages")
      .update({ status: "paid" })
      .eq("id", updated.stage_id)
      .eq("status", "quote_approved");
    if (stageErr) console.error(`[payments] stage paid: ${stageErr.message}`);
  }

  // Invoice for extra payments (deposit/balance invoices are created
  // at acceptance / publication)
  if (updated.kind === "extra") {
    const { data: inv } = await admin
      .from("invoices")
      .select("id")
      .eq("payment_id", updated.id)
      .maybeSingle();
    if (!inv) {
      await admin.from("invoices").insert({
        request_id: updated.request_id,
        quote_id: updated.quote_id,
        payment_id: updated.id,
        kind: "extra",
        amount_cents: updated.amount_cents,
        details: { merchant_reference: merchantReference },
      });
    }
  }

  await admin.rpc("log_audit", {
    p_action: "payment.confirmed",
    p_entity: "payment",
    p_entity_id: updated.id,
    p_data: {
      reference: merchantReference,
      amount_cents: updated.amount_cents,
      via: opts.viaWebhook ? "paynow_webhook" : "manual",
      confirmed_by: opts.confirmedBy ?? "system",
    },
  });

  // Notify the client
  const { data: req } = await admin
    .from("service_requests")
    .select("title, client_id, profiles:client_id(email, full_name)")
    .eq("id", updated.request_id)
    .single();
  const clientProfile = req?.profiles as unknown as {
    email?: string;
    full_name?: string;
  } | null;
  if (clientProfile?.email) {
    await sendEmail({
      to: clientProfile.email,
      subject: "LBH — payment received",
      text: `Hi ${clientProfile.full_name ?? ""},\n\nWe received your ${updated.kind} payment of $${(updated.amount_cents / 100).toFixed(2)} for "${req?.title}". Thank you!\n\nLBH — Let's Build Home`,
    });
  }

  return "confirmed";
}

export async function failPaymentByReference(
  merchantReference: string,
  reason: string
): Promise<void> {
  const admin = createAdminClient();
  const { data: updated } = await admin
    .from("payments")
    .update({ status: "failed" })
    .eq("merchant_reference", merchantReference)
    .in("status", ["pending", "submitted"])
    .select("id")
    .maybeSingle();
  if (updated) {
    await admin.rpc("log_audit", {
      p_action: "payment.failed",
      p_entity: "payment",
      p_entity_id: updated.id,
      p_data: { reference: merchantReference, reason },
    });
  }
}
