/**
 * Turn the text read from a receipt photo into shop, date, items and total.
 * Pure function — the person always checks and can edit the result.
 */
export interface ParsedReceipt {
  shop: string;
  date: string | null; // YYYY-MM-DD
  items: { name: string; qty: number; unit_cents: number; total_cents: number }[];
  total_cents: number | null;
}

const MONEY = /(?<![\d.,])(\d{1,3}(?:,\d{3})+|\d+)[.,](\d{2})\s*$/; // "1,234.50"; a space is never a thousands separator
const SKIP = /\b(sub\s*total|total|vat|tax|change|cash|card|tendered|balance|tel|phone|fax|date|time|receipt|invoice|thank|www|vat\s*no)\b/i;

function cents(whole: string, dec: string): number {
  return Number(whole.replace(/[ ,]/g, "")) * 100 + Number(dec);
}

function isoDate(line: string): string | null {
  let m = line.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = line.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/); // day first (Zimbabwe/UK style)
  if (m) return valid(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  return null;
}
function valid(y: number, mo: number, d: number): string | null {
  if (y < 2000 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function parseReceiptText(text: string): ParsedReceipt {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const shop = lines.find((l) => /[a-z]{3,}/i.test(l) && !SKIP.test(l) && !MONEY.test(l))?.slice(0, 120) ?? "";
  let date: string | null = null;
  for (const l of lines) {
    date = isoDate(l);
    if (date) break;
  }

  let total: number | null = null;
  for (const l of lines) {
    if (/\btotal\b/i.test(l) && !/sub\s*total/i.test(l)) {
      const m = l.match(MONEY);
      if (m) total = cents(m[1], m[2]);
    }
  }

  const items: ParsedReceipt["items"] = [];
  for (const l of lines) {
    if (SKIP.test(l)) continue;
    const m = l.match(MONEY);
    if (!m) continue;
    const lineTotal = cents(m[1], m[2]);
    let rest = l.slice(0, m.index).trim();
    let qty = 1;
    let unit = lineTotal;
    const q = rest.match(/(\d+(?:\.\d+)?)\s*[x×@]\s*(\d+)[.,](\d{2})\s*$/i);
    if (q) {
      qty = Number(q[1]);
      unit = cents(q[2], q[3]);
      rest = rest.slice(0, q.index).trim();
    }
    const name = rest.replace(/[-–:]+$/, "").trim();
    if (!/[a-z]{2,}/i.test(name) || lineTotal <= 0) continue;
    items.push({ name: name.slice(0, 120), qty, unit_cents: unit, total_cents: lineTotal });
  }

  if (total === null && items.length) total = items.reduce((s, i) => s + i.total_cents, 0);
  return { shop, date, items: items.slice(0, 40), total_cents: total };
}
