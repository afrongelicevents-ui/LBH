import "server-only";
import { createHash } from "node:crypto";

/**
 * Paynow (paynow.co.zw) server-side integration.
 *
 * Protocol (Paynow docs): form-encoded POST to InitiateTransaction with a
 * SHA512 hash of all field values concatenated + integration key, uppercase
 * hex. Responses and result webhooks carry the same hash scheme and MUST be
 * verified. Every status is additionally confirmed server-side via the poll
 * URL before money state changes (brief §10: never trust client-side state).
 *
 * TEST MODE: when PAYNOW_INTEGRATION_ID/KEY are not set, payments run through
 * a built-in, clearly-labelled simulated checkout — no external calls.
 */

const INITIATE_URL = "https://www.paynow.co.zw/interface/initiatetransaction";

export function paynowConfigured(): boolean {
  return Boolean(
    process.env.PAYNOW_INTEGRATION_ID && process.env.PAYNOW_INTEGRATION_KEY
  );
}

/**
 * The simulated checkout lets a client mark their own payment as paid, so it
 * must be an explicit opt-in (PAYMENTS_TEST_MODE=true) and is always off once
 * real Paynow credentials exist. A production deploy that forgets the keys
 * gets "online payments unavailable", never free payments.
 */
export function simulatedPaymentsEnabled(): boolean {
  return !paynowConfigured() && process.env.PAYMENTS_TEST_MODE === "true";
}

/** Uppercase SHA512 hex of concatenated values + integration key. */
export function paynowHash(values: string[], integrationKey: string): string {
  return createHash("sha512")
    .update(values.join("") + integrationKey, "utf8")
    .digest("hex")
    .toUpperCase();
}

/** Verify the hash on a Paynow message (response or result webhook). */
export function verifyPaynowMessage(
  params: Record<string, string>,
  integrationKey: string
): boolean {
  const hash = params["hash"];
  if (!hash) return false;
  // Order matters: Paynow hashes values in the order the fields were sent.
  const values = Object.entries(params)
    .filter(([k]) => k.toLowerCase() !== "hash")
    .map(([, v]) => v);
  const expected = paynowHash(values, integrationKey);
  // timing-safe-ish comparison (both fixed length uppercase hex)
  if (hash.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= hash.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

function parseFormBody(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(body)) out[k] = v;
  return out;
}

export interface InitiateResult {
  redirectUrl: string;
  pollUrl: string;
  simulated: boolean;
}

/** Start a Paynow checkout; returns the browser redirect + poll URLs. */
export async function initiatePaynowPayment(opts: {
  merchantReference: string;
  amountCents: number;
  email: string;
  returnUrl: string;
}): Promise<InitiateResult> {
  if (!paynowConfigured()) {
    if (!simulatedPaymentsEnabled()) {
      throw new Error("online payments unavailable");
    }
    // Simulated test checkout, handled inside the app.
    return {
      redirectUrl: `/pay/simulate?ref=${encodeURIComponent(opts.merchantReference)}`,
      pollUrl: `simulated:${opts.merchantReference}`,
      simulated: true,
    };
  }

  const id = process.env.PAYNOW_INTEGRATION_ID!;
  const key = process.env.PAYNOW_INTEGRATION_KEY!;
  const resultUrl = process.env.PAYNOW_RESULT_URL ?? "";

  const fields: [string, string][] = [
    ["id", id],
    ["reference", opts.merchantReference],
    ["amount", (opts.amountCents / 100).toFixed(2)],
    ["additionalinfo", "LBH service payment"],
    ["returnurl", opts.returnUrl],
    ["resulturl", resultUrl],
    ["authemail", opts.email],
    ["status", "Message"],
  ];
  const hash = paynowHash(fields.map(([, v]) => v), key);
  const body = new URLSearchParams([...fields, ["hash", hash]]).toString();

  const res = await fetch(INITIATE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const parsed = parseFormBody(await res.text());

  if (parsed["status"]?.toLowerCase() !== "ok") {
    throw new Error(`Paynow initiate failed: ${parsed["error"] ?? "unknown"}`);
  }
  if (!verifyPaynowMessage(parsed, key)) {
    throw new Error("Paynow initiate response failed hash verification");
  }
  return {
    redirectUrl: parsed["browserurl"],
    pollUrl: parsed["pollurl"],
    simulated: false,
  };
}

export type PaynowStatus =
  | "paid"
  | "awaiting_delivery"
  | "cancelled"
  | "failed"
  | "created"
  | "sent"
  | "disputed"
  | "refunded"
  | "unknown";

export function normalizePaynowStatus(raw: string | undefined): PaynowStatus {
  switch ((raw ?? "").toLowerCase().replace(/\s+/g, "_")) {
    case "paid":
      return "paid";
    case "awaiting_delivery":
      return "awaiting_delivery";
    case "delivered":
      return "paid";
    case "cancelled":
      return "cancelled";
    case "failed":
      return "failed";
    case "created":
      return "created";
    case "sent":
      return "sent";
    case "disputed":
      return "disputed";
    case "refunded":
      return "refunded";
    default:
      return "unknown";
  }
}

/** Authoritative status check straight from Paynow (server → server). */
export async function pollPaynowStatus(pollUrl: string): Promise<{
  status: PaynowStatus;
  reference: string | null;
  paynowReference: string | null;
  amount: string | null;
  hashValid: boolean;
}> {
  const key = process.env.PAYNOW_INTEGRATION_KEY!;
  const res = await fetch(pollUrl, { method: "POST" });
  const parsed = parseFormBody(await res.text());
  return {
    status: normalizePaynowStatus(parsed["status"]),
    reference: parsed["reference"] ?? null,
    paynowReference: parsed["paynowreference"] ?? null,
    amount: parsed["amount"] ?? null,
    hashValid: verifyPaynowMessage(parsed, key),
  };
}
