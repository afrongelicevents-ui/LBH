import { getUserProfile } from "@/lib/supabase/server";
import { renderPdf, pdfHeader, pdfFooter, kv } from "@/lib/pdf";
import { formatCents } from "@/lib/money";
import { baContext, loadBa } from "@/lib/buildAccount/server";
import * as M from "@/lib/buildAccount/math";
import { accountName, currentMonth } from "@/lib/buildAccount/view";

const clean = (s: string) => s.replace(/^SAMPLE\s+/, "");

/** Monthly Build Account statement (PDF). Access: owner or invited family member; RLS scopes the rows. */
export async function GET(req: Request) {
  const { supabase, user } = await getUserProfile();
  if (!user) return new Response("not authorised", { status: 401 });
  const url = new URL(req.url);
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(url.searchParams.get("month") ?? "") ? url.searchParams.get("month")! : currentMonth();
  const ctx = await baContext(supabase, user.id, url.searchParams.get("owner"));
  if (!ctx) return new Response("not found", { status: 404 });
  const data = await loadBa(supabase, ctx);
  const acctParam = url.searchParams.get("acct");
  const acct = acctParam && data.accounts.some((a) => a.id === acctParam) ? acctParam : "all";

  const all = M.inAccount(data.entries, acct);
  const before = all.filter((e) => M.monthKey(e.occurred_on) < month);
  const inMonth = all.filter((e) => M.monthKey(e.occurred_on) === month);
  const opening = M.balance(before);
  let run = opening;
  const rows = M.chronological(inMonth).map((e) => {
    if (M.counts(e)) run += M.signed(e);
    return { ...e, running_cents: run };
  });
  const [y, m] = month.split("-").map(Number);
  const monthName = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

  const pdf = await renderPdf((doc) => {
    pdfHeader(doc, `Build Account statement — ${monthName}`);
    kv(doc, "Account holder", clean(data.ownerName));
    kv(doc, "Account", acct === "all" ? "All accounts" : accountName(data, acct));
    kv(doc, "Opening balance", formatCents(opening));
    kv(doc, "Money in (confirmed)", formatCents(M.moneyIn(inMonth)));
    kv(doc, "Spent", formatCents(M.spent(inMonth)));
    kv(doc, "Closing balance", formatCents(run));
    doc.moveDown(1);

    const cols = [50, 110, 330, 405, 475];
    const header = (yy: number) => {
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#163A2B");
      ["Date", "Description", "In", "Out", "Balance"].forEach((h, i) => doc.text(h, cols[i], yy, { width: i === 1 ? 215 : 65 }));
      doc.font("Helvetica").fillColor("#1B1F1C");
    };
    header(doc.y);
    doc.moveDown(0.4);
    if (rows.length === 0) doc.text("Nothing recorded this month.", 50);
    for (const r of rows) {
      if (doc.y > 760) {
        doc.addPage();
        header(50);
        doc.moveDown(0.4);
      }
      const yy = doc.y;
      const desc =
        clean(r.description || r.shop) +
        (r.status === "pending" ? " (on its way — not counted)" : r.status === "rejected" ? " (not received)" : "") +
        (r.direction === "out" && !M.hasReceipt(r) ? " · no receipt" : "");
      doc.fontSize(9);
      doc.text(r.occurred_on, cols[0], yy, { width: 60 });
      doc.text(desc, cols[1], yy, { width: 215 });
      const h = doc.y;
      doc.text(r.direction === "in" ? formatCents(r.amount_cents) : "", cols[2], yy, { width: 65 });
      doc.text(r.direction === "out" ? formatCents(r.amount_cents) : "", cols[3], yy, { width: 65 });
      doc.text(formatCents(r.running_cents), cols[4], yy, { width: 70 });
      doc.y = Math.max(h, doc.y) + 3;
    }
    doc.x = 50;
    pdfFooter(doc, "All amounts in USD. This is a record of your build money, not a bank account.");
  });

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="build-account-${month}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
