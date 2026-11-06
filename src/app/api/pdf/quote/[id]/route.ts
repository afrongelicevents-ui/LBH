import { getUserProfile } from "@/lib/supabase/server";
import { renderPdf, pdfHeader, pdfFooter, kv } from "@/lib/pdf";
import { formatCents, depositSplit } from "@/lib/money";

/** Quote PDF — RLS scopes access (admin, or owning client once sent). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { supabase, user } = await getUserProfile();
  if (!user) return new Response("not authorised", { status: 401 });

  const { data: quote } = await supabase
    .from("quotes")
    .select("*, quote_lines(*), service_requests(title, profiles:client_id(full_name, email))")
    .eq("id", id)
    .maybeSingle();
  if (!quote) return new Response("not found", { status: 404 });

  const req = quote.service_requests as unknown as {
    title: string;
    profiles: { full_name: string; email: string } | null;
  };
  const split = depositSplit(quote.total_cents, quote.deposit_pct);

  const pdf = await renderPdf((doc) => {
    pdfHeader(doc, `Quote #${quote.quote_number}`);
    kv(doc, "For", `${req.profiles?.full_name ?? ""} <${req.profiles?.email ?? ""}>`);
    kv(doc, "Request", req.title);
    kv(doc, "Date", new Date(quote.created_at).toDateString());
    kv(doc, "Status", quote.status);
    doc.moveDown(0.8);

    for (const line of (quote.quote_lines ?? []).sort(
      (a: { position: number }, b: { position: number }) => a.position - b.position
    )) {
      doc
        .font("Helvetica")
        .fillColor("#1B1F1C")
        .text(line.description, { continued: false, width: 360 });
      doc.moveUp();
      doc.font("Helvetica-Bold").text(formatCents(line.total_cents), 420, doc.y, {
        align: "right",
        width: 125,
      });
      doc.moveDown(0.3);
      doc.x = 50;
    }
    doc.moveDown(0.5);
    doc.font("Helvetica-Bold").fontSize(12).fillColor("#163A2B");
    doc.text(`Total: ${formatCents(quote.total_cents)}`, { align: "right" });
    doc.fontSize(10);
    doc.text(
      `Deposit (${quote.deposit_pct}%): ${formatCents(split.deposit)}   ·   Balance: ${formatCents(split.balance)}`,
      { align: "right" }
    );
    if (quote.notes) {
      doc.moveDown(0.6);
      doc.font("Helvetica").fontSize(9).fillColor("#5E6862").text(quote.notes);
    }
    if (quote.accepted_by_name) {
      doc.moveDown(0.6);
      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor("#163A2B")
        .text(
          `Accepted by ${quote.accepted_by_name} on ${new Date(quote.accepted_at!).toUTCString()} (written acceptance)`
        );
    }
    pdfFooter(
      doc,
      "Work begins after acceptance and the deposit. No extra cost is incurred without your approval."
    );
  });

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="lbh-quote-${quote.quote_number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
