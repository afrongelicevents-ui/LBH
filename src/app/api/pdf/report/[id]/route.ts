import { getUserProfile } from "@/lib/supabase/server";
import { renderPdf, pdfHeader, pdfFooter, kv } from "@/lib/pdf";

const SECTION_TITLES: [string, string][] = [
  ["stand_details", "Stand details"],
  ["legal_findings", "Legal & title check findings"],
  ["council_confirmation", "Council confirmation"],
  ["measurements", "Measurements vs documents"],
  ["red_flags", "Red flags, explained plainly"],
  ["next_steps", "Recommended next step"],
  ["costs_summary", "Costs & travel reconciliation"],
];

const VERDICT_TEXT: Record<string, string> = {
  clear: "CLEAR — no red flags found in this check",
  concerns: "CONCERNS — read the findings before paying anything more",
  red_flags: "RED FLAGS — do not proceed before resolving these",
};

/** Land verification report PDF (brief §7) — published reports only via RLS. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { supabase, user } = await getUserProfile();
  if (!user) return new Response("not authorised", { status: 401 });

  const { data: report } = await supabase
    .from("reports")
    .select("*, service_requests(title, profiles:client_id(full_name))")
    .eq("id", id)
    .maybeSingle();
  if (!report) return new Response("not found", { status: 404 });

  // Clients can only read published reports via RLS; double-check anyway.
  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (me?.role !== "admin" && report.status !== "published") {
    return new Response("not found", { status: 404 });
  }

  const req = report.service_requests as unknown as {
    title: string;
    profiles: { full_name: string } | null;
  };
  const sections = (report.sections ?? {}) as Record<string, string>;

  const pdf = await renderPdf((doc) => {
    pdfHeader(doc, `Land Verification Report — ${req.title}`);
    kv(doc, "Prepared for", req.profiles?.full_name ?? "");
    kv(
      doc,
      "Published",
      report.published_at ? new Date(report.published_at).toDateString() : "—"
    );
    doc.moveDown(0.8);

    // Verdict block
    const verdictColor =
      report.verdict === "clear"
        ? "#163A2B"
        : report.verdict === "concerns"
          ? "#0A0A0A"
          : "#B91C1C";
    doc
      .font("Helvetica-Bold")
      .fontSize(13)
      .fillColor(verdictColor)
      .text(`VERDICT: ${VERDICT_TEXT[report.verdict ?? "concerns"]}`);
    doc.moveDown(0.6);
    doc.fontSize(10).fillColor("#1B1F1C");

    for (const [key, title] of SECTION_TITLES) {
      const body = sections[key];
      if (!body) continue;
      doc.font("Helvetica-Bold").fillColor("#163A2B").fontSize(11).text(title);
      doc.moveDown(0.15);
      doc.font("Helvetica").fillColor("#1B1F1C").fontSize(10).text(body);
      doc.moveDown(0.6);
    }

    doc.moveDown(0.4);
    doc
      .font("Helvetica-Oblique")
      .fontSize(9)
      .fillColor("#5E6862")
      .text(
        "This report is a physical and documentary check carried out on the dates stated. It is not a guarantee."
      );
    pdfFooter(doc, "Dated photos and video are available in your client portal.");
  });

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="lbh-report.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
