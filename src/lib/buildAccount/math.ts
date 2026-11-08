/**
 * Build Account maths — pure functions (no database), unit-tested.
 * All money is integer USD cents.
 *
 * Rules:
 *   balance  = money sent in (CONFIRMED only) − money spent
 *   "on its way" (pending) money in is shown but not counted
 *   rejected money in is ignored
 */

export interface BaEntry {
  id: string;
  account_id: string;
  direction: "in" | "out";
  amount_cents: number;
  fee_cents: number;
  occurred_on: string; // YYYY-MM-DD
  created_at: string;
  status: "pending" | "confirmed" | "rejected";
  description: string;
  shop: string;
  service: string | null;
  stage_name: string | null;
  items: { name: string; qty?: number; unit_cents?: number; total_cents?: number }[];
  receipt_path: string | null;
  receipt_source: "photo" | "lbh" | null;
  source: string;
}

export interface BaAccount {
  id: string;
  name: string;
  kind: "lbh" | "family" | "own";
  holder_member_id: string | null;
}

export interface PriceItem {
  id: string;
  item: string;
  unit: string;
  area: string;
  price_cents: number;
}

export const counts = (e: BaEntry) => e.direction === "out" || e.status === "confirmed";
export const signed = (e: BaEntry) => (e.direction === "in" ? e.amount_cents : -e.amount_cents);
export const hasReceipt = (e: BaEntry) => Boolean(e.receipt_path || e.receipt_source);

export function inAccount(entries: BaEntry[], accountId: string | "all"): BaEntry[] {
  return accountId === "all" ? entries : entries.filter((e) => e.account_id === accountId);
}

export function balance(entries: BaEntry[]): number {
  return entries.filter(counts).reduce((s, e) => s + signed(e), 0);
}

export function moneyIn(entries: BaEntry[]): number {
  return entries.filter((e) => e.direction === "in" && e.status === "confirmed").reduce((s, e) => s + e.amount_cents, 0);
}

export function spent(entries: BaEntry[]): number {
  return entries.filter((e) => e.direction === "out").reduce((s, e) => s + e.amount_cents, 0);
}

export function onItsWay(entries: BaEntry[]): number {
  return entries.filter((e) => e.direction === "in" && e.status === "pending").reduce((s, e) => s + e.amount_cents, 0);
}

export function monthKey(date: string): string {
  return date.slice(0, 7); // YYYY-MM
}

export function sentInMonth(entries: BaEntry[], month: string): number {
  return moneyIn(entries.filter((e) => monthKey(e.occurred_on) === month));
}

/** Oldest first: date, then when it was recorded. */
export function chronological(entries: BaEntry[]): BaEntry[] {
  return [...entries].sort((a, b) =>
    a.occurred_on === b.occurred_on ? a.created_at.localeCompare(b.created_at) : a.occurred_on.localeCompare(b.occurred_on)
  );
}

export interface StatementRow extends BaEntry {
  /** balance after this line (unchanged by pending / rejected money) */
  running_cents: number;
}

/** Bank-style statement, newest first, with the running balance per line. */
export function statement(entries: BaEntry[]): StatementRow[] {
  let run = 0;
  const rows = chronological(entries).map((e) => {
    if (counts(e)) run += signed(e);
    return { ...e, running_cents: run };
  });
  return rows.reverse();
}

export interface SentStats {
  total_cents: number;
  this_month_cents: number;
  transfers: number;
  fees_cents: number;
  by_month: { month: string; cents: number }[];
  by_service: { service: string; cents: number; count: number }[];
  by_account: { account_id: string; cents: number }[];
}

/** "Money sent" screen: confirmed money in only. */
export function sentStats(entries: BaEntry[], currentMonth: string, months = 6): SentStats {
  const sent = entries.filter((e) => e.direction === "in" && e.status === "confirmed");
  const by = <K extends string>(key: (e: BaEntry) => K) => {
    const m = new Map<K, { cents: number; count: number }>();
    for (const e of sent) {
      const k = key(e);
      const cur = m.get(k) ?? { cents: 0, count: 0 };
      m.set(k, { cents: cur.cents + e.amount_cents, count: cur.count + 1 });
    }
    return m;
  };
  const [y, mo] = currentMonth.split("-").map(Number);
  const monthsList: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, mo - 1 - i, 1));
    monthsList.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  const perMonth = by((e) => monthKey(e.occurred_on));
  return {
    total_cents: moneyIn(sent),
    this_month_cents: perMonth.get(currentMonth)?.cents ?? 0,
    transfers: sent.length,
    fees_cents: sent.reduce((s, e) => s + e.fee_cents, 0),
    by_month: monthsList.map((m) => ({ month: m, cents: perMonth.get(m)?.cents ?? 0 })),
    by_service: [...by((e) => (e.source === "lbh_payment" ? "lbh_portal" : e.service ?? "other"))]
      .map(([service, v]) => ({ service, ...v }))
      .sort((a, b) => b.cents - a.cents),
    by_account: [...by((e) => e.account_id)].map(([account_id, v]) => ({ account_id, cents: v.cents })),
  };
}

export interface StageBudget {
  stage: string;
  budget_cents: number | null;
  spent_cents: number;
  over: boolean;
}

export function stageBudgets(
  entries: BaEntry[],
  stages: string[],
  budgets: Record<string, number>
): StageBudget[] {
  return stages.map((stage) => {
    const s = entries.filter((e) => e.direction === "out" && e.stage_name === stage).reduce((t, e) => t + e.amount_cents, 0);
    const b = budgets[stage] ?? null;
    return { stage, budget_cents: b, spent_cents: s, over: b !== null && s > b };
  });
}

// ---------- price check ----------
const STOP = new Set(["sample", "the", "and", "of", "per", "for", "bag", "bags", "load", "loads", "kg", "x"]);
export function words(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9.\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP.has(w) && !/^\d+(\.\d+)?$/.test(w));
}

/** Best price-list match for an item name (most shared words), or null. */
export function matchPrice(name: string, list: PriceItem[]): PriceItem | null {
  const w = new Set(words(name));
  if (w.size === 0) return null;
  let best: { p: PriceItem; score: number } | null = null;
  for (const p of list) {
    const pw = words(p.item);
    if (pw.length === 0) continue;
    const shared = pw.filter((x) => w.has(x)).length;
    const score = shared / pw.length;
    if (shared > 0 && score >= 0.5 && (!best || score > best.score)) best = { p, score };
  }
  return best?.p ?? null;
}

/** Items bought for more than the usual price (+10% tolerance). */
export const PRICE_TOLERANCE = 0.1;
export function priceWarnings(entries: BaEntry[], list: PriceItem[]) {
  const out: { entry_id: string; item: string; paid_cents: number; usual_cents: number; unit: string; area: string }[] = [];
  for (const e of entries) {
    if (e.direction !== "out") continue;
    for (const it of e.items ?? []) {
      const unit = it.unit_cents ?? (it.total_cents && it.qty ? Math.round(it.total_cents / it.qty) : undefined);
      if (!unit) continue;
      const p = matchPrice(it.name, list);
      if (p && unit > p.price_cents * (1 + PRICE_TOLERANCE)) {
        out.push({ entry_id: e.id, item: it.name, paid_cents: unit, usual_cents: p.price_cents, unit: p.unit, area: p.area });
      }
    }
  }
  return out;
}

/** Money a family member holds that isn't backed by receipts yet. */
export function unbackedFamilyMoney(entries: BaEntry[], accounts: BaAccount[]) {
  return accounts
    .filter((a) => a.kind === "family")
    .map((a) => {
      const own = inAccount(entries, a.id);
      const received = moneyIn(own);
      const backed = own.filter((e) => e.direction === "out" && hasReceipt(e)).reduce((s, e) => s + e.amount_cents, 0);
      return { account_id: a.id, name: a.name, unbacked_cents: Math.max(0, received - backed) };
    })
    .filter((x) => x.unbacked_cents > 0);
}

export type Alert =
  | { kind: "no_receipt"; entry_id: string; description: string; amount_cents: number }
  | { kind: "price"; entry_id: string; item: string; paid_cents: number; usual_cents: number; unit: string; area: string }
  | { kind: "over_budget"; stage: string; budget_cents: number; spent_cents: number }
  | { kind: "unbacked"; account_id: string; name: string; unbacked_cents: number };

export function alerts(
  entries: BaEntry[],
  accounts: BaAccount[],
  list: PriceItem[],
  budgets: StageBudget[]
): Alert[] {
  return [
    ...entries
      .filter((e) => e.direction === "out" && !hasReceipt(e))
      .map((e) => ({ kind: "no_receipt" as const, entry_id: e.id, description: e.description || e.shop, amount_cents: e.amount_cents })),
    ...priceWarnings(entries, list).map((p) => ({ kind: "price" as const, ...p })),
    ...budgets
      .filter((b) => b.over)
      .map((b) => ({ kind: "over_budget" as const, stage: b.stage, budget_cents: b.budget_cents ?? 0, spent_cents: b.spent_cents })),
    ...unbackedFamilyMoney(entries, accounts).map((u) => ({ kind: "unbacked" as const, ...u })),
  ];
}
