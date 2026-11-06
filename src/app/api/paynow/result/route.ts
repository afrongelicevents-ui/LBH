import { NextResponse } from "next/server";
import {
  paynowConfigured,
  verifyPaynowMessage,
  pollPaynowStatus,
  normalizePaynowStatus,
} from "@/lib/paynow";
import {
  confirmPaymentByReference,
  failPaymentByReference,
} from "@/lib/payments";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Paynow result webhook (brief §10): hash-verified, then re-confirmed via
 * the poll URL stored at initiation (never the one in the webhook body —
 * a forged body cannot redirect the status check), idempotent.
 */
export async function POST(request: Request) {
  if (!paynowConfigured()) {
    return NextResponse.json({ error: "paynow not configured" }, { status: 404 });
  }
  const key = process.env.PAYNOW_INTEGRATION_KEY!;

  const bodyText = await request.text();
  const params: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(bodyText)) params[k] = v;

  if (!verifyPaynowMessage(params, key)) {
    return NextResponse.json({ error: "bad hash" }, { status: 400 });
  }

  const reference = params["reference"];
  if (!reference) {
    return NextResponse.json({ error: "no reference" }, { status: 400 });
  }

  // Authoritative re-check against the poll URL we stored at initiation.
  const admin = createAdminClient();
  const { data: payment } = await admin
    .from("payments")
    .select("id, paynow_poll_url")
    .eq("merchant_reference", reference)
    .maybeSingle();
  if (!payment) {
    return NextResponse.json({ error: "unknown reference" }, { status: 404 });
  }

  let status = normalizePaynowStatus(params["status"]);
  let paynowReference: string | null = params["paynowreference"] ?? null;
  if (payment.paynow_poll_url) {
    const polled = await pollPaynowStatus(payment.paynow_poll_url);
    if (!polled.hashValid) {
      return NextResponse.json({ error: "poll hash invalid" }, { status: 400 });
    }
    status = polled.status;
    paynowReference = polled.paynowReference ?? paynowReference;
  }

  if (status === "paid" || status === "awaiting_delivery") {
    await confirmPaymentByReference(reference, {
      viaWebhook: true,
      paynowReference,
    });
  } else if (["cancelled", "failed", "disputed"].includes(status)) {
    await failPaymentByReference(reference, `paynow status: ${status}`);
  }

  return NextResponse.json({ ok: true });
}
