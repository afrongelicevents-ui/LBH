import { getUserProfile } from "@/lib/supabase/server";
import { renderPdf, pdfHeader, pdfFooter, kv } from "@/lib/pdf";
import { formatCents } from "@/lib/money";

/** Invoice PDF — sequential numbers (brief §10); RLS scopes access. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { supabase, user } = await getUserProfile();
  if (!user) return new Response("not authorised", { status: 401 });

  const { data: invoice } = await supabase
    .from("invoices")
    .select(
      "*, service_requests(title, profiles:client_id(full_name, email)), payments(status, merchant_reference, confirmed_at)"
    )
    .eq("id", id)
    .maybeSingle();
  if (!invoice) return new Response("not found", { status: 404 });

  const req = invoice.service_requests as unknown as {
    title: string;
    profiles: { full_name: string; email: string } | null;
  };
  const payment = invoice.payments as unknown as {
    status: string;
    merchant_reference: string;
    confirmed_at: string | null;
  } | null;

  const pdf = await renderPdf((doc) => {
    pdfHeader(doc, `Invoice #${invoice.invoice_number}`);
    kv(doc, "Billed to", `${req.profiles?.full_name ?? ""} <${req.profiles?.email ?? ""}>`);
    kv(doc, "Request", req.title);
    kv(doc, "Issued", new Date(invoice.issued_at).toDateString());
    kv(doc, "Type", invoice.kind);
    if (payment) {
      kv(doc, "Payment reference", payment.merchant_reference);
      kv(
        doc,
        "Payment status",
        payment.status + (payment.confirmed_at ? ` (${new Date(payment.confirmed_at).toDateString()})` : "")
      );
    }
    doc.moveDown(1);
    doc
      .font("Helvetica-Bold")
      .fontSize(16)
      .fillColor("#163A2B")
      .text(`Amount due: ${formatCents(invoice.amount_cents)} (USD)`);
    pdfFooter(doc, "All amounts in USD.");
  });

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="lbh-invoice-${invoice.invoice_number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
