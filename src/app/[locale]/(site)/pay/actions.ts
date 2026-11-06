"use server";

import { redirect } from "next/navigation";
import { getUserProfile } from "@/lib/supabase/server";
import { paynowConfigured } from "@/lib/paynow";
import {
  confirmPaymentByReference,
  failPaymentByReference,
} from "@/lib/payments";

/**
 * TEST MODE ONLY: simulate the outcome of a payment. Hard-disabled the
 * moment real Paynow credentials are configured.
 */
export async function simulatePaymentOutcome(
  reference: string,
  outcome: "paid" | "failed",
  locale: string
) {
  if (paynowConfigured()) throw new Error("simulation disabled in live mode");

  const { supabase, user, profile } = await getUserProfile();
  if (!user || !profile || profile.role !== "client") {
    throw new Error("not authorised");
  }
  // RLS: client can only read their own payment → ownership check
  const { data: payment } = await supabase
    .from("payments")
    .select("id, merchant_reference, status")
    .eq("merchant_reference", reference)
    .maybeSingle();
  if (!payment) throw new Error("payment not found");

  if (outcome === "paid") {
    await confirmPaymentByReference(reference, {
      confirmedBy: user.id,
      viaWebhook: false,
      paynowReference: `SIMULATED-${Date.now()}`,
    });
  } else {
    await failPaymentByReference(reference, "simulated failure (test mode)");
  }

  redirect(`/${locale}/pay/return?ref=${encodeURIComponent(reference)}`);
}
