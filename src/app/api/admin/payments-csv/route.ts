import { requireAdminAction } from "@/lib/auth/admin-guard";

function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

/** Payments CSV export (brief §8) — admin + AAL2 only. */
export async function GET() {
  let ctx;
  try {
    ctx = await requireAdminAction();
  } catch {
    return new Response("not authorised", { status: 403 });
  }

  const { data: payments } = await ctx.supabase
    .from("payments")
    .select(
      "created_at, kind, method, status, amount_cents, currency, merchant_reference, paynow_reference, proof_reference, confirmed_at, service_requests(title)"
    )
    .order("created_at", { ascending: false })
    .limit(5000);

  const header =
    "created_at,request,kind,method,status,amount_usd,currency,merchant_reference,paynow_reference,proof_reference,confirmed_at";
  const rows = (payments ?? []).map((p) =>
    [
      p.created_at,
      (p.service_requests as unknown as { title: string })?.title ?? "",
      p.kind,
      p.method,
      p.status,
      (p.amount_cents / 100).toFixed(2),
      p.currency,
      p.merchant_reference,
      p.paynow_reference ?? "",
      p.proof_reference ?? "",
      p.confirmed_at ?? "",
    ]
      .map(csvEscape)
      .join(",")
  );

  return new Response([header, ...rows].join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="lbh-payments-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
