/** All amounts are USD integer cents (brief §10). */
export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function depositSplit(totalCents: number, depositPct: number) {
  const deposit = Math.ceil((totalCents * depositPct) / 100);
  return { deposit, balance: totalCents - deposit };
}

/** Parse a user-entered dollar amount ("12.50") into integer cents. */
export function parseDollarsToCents(input: string): number | null {
  const cleaned = input.replace(/[^0-9.]/g, "");
  if (!cleaned || !/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const cents = Math.round(parseFloat(cleaned) * 100);
  return Number.isSafeInteger(cents) && cents >= 0 ? cents : null;
}
