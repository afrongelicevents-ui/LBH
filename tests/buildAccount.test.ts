import { describe, expect, it } from "vitest";
import * as M from "../src/lib/buildAccount/math";
import { parseReceiptText } from "../src/lib/buildAccount/parseReceipt";
import { planOf, isWritable } from "../src/lib/buildAccount/plan";

let n = 0;
function e(p: Partial<M.BaEntry>): M.BaEntry {
  n++;
  return {
    id: `e${n}`,
    account_id: "lbh",
    direction: "out",
    amount_cents: 0,
    fee_cents: 0,
    occurred_on: "2026-10-01",
    created_at: `2026-10-01T00:00:${String(n).padStart(2, "0")}Z`,
    status: "confirmed",
    description: "",
    shop: "",
    service: null,
    stage_name: null,
    items: [],
    receipt_path: null,
    receipt_source: null,
    source: "manual",
    ...p,
  };
}

describe("Build Account balance maths", () => {
  const entries = [
    e({ direction: "in", amount_cents: 60000, fee_cents: 1800, status: "confirmed", occurred_on: "2026-10-02", service: "mukuru" }),
    e({ direction: "in", amount_cents: 30000, status: "pending", occurred_on: "2026-11-01" }),
    e({ direction: "in", amount_cents: 99999, status: "rejected", occurred_on: "2026-11-02" }),
    e({ direction: "out", amount_cents: 19000, occurred_on: "2026-10-05", receipt_path: "ba/x/y.jpg" }),
    e({ direction: "out", amount_cents: 13500, occurred_on: "2026-11-03", account_id: "fam" }),
  ];

  it("balance = confirmed money in − money spent; pending and rejected are not counted", () => {
    expect(M.balance(entries)).toBe(60000 - 19000 - 13500);
    expect(M.moneyIn(entries)).toBe(60000);
    expect(M.spent(entries)).toBe(32500);
    expect(M.onItsWay(entries)).toBe(30000);
  });

  it("the transfer fee is not deducted from the balance", () => {
    expect(M.balance([entries[0]])).toBe(60000);
  });

  it("filters by account", () => {
    expect(M.balance(M.inAccount(entries, "fam"))).toBe(-13500);
    expect(M.inAccount(entries, "all")).toHaveLength(5);
  });

  it("sent this month counts confirmed money in that month only", () => {
    expect(M.sentInMonth(entries, "2026-10")).toBe(60000);
    expect(M.sentInMonth(entries, "2026-11")).toBe(0);
  });

  it("statement is newest first with a running balance that ignores pending money", () => {
    const s = M.statement(entries);
    expect(s[0].occurred_on).toBe("2026-11-03");
    expect(s.map((r) => r.running_cents)).toEqual([27500, 41000, 41000, 41000, 60000]);
    expect(s[s.length - 1].running_cents).toBe(60000);
    expect(s[0].running_cents).toBe(M.balance(entries));
  });

  it("same-day lines keep the order they were recorded in", () => {
    const a = e({ direction: "in", amount_cents: 100, occurred_on: "2026-01-01", created_at: "2026-01-01T10:00:00Z" });
    const b = e({ direction: "out", amount_cents: 40, occurred_on: "2026-01-01", created_at: "2026-01-01T09:00:00Z" });
    expect(M.chronological([a, b]).map((x) => x.id)).toEqual([b.id, a.id]);
    expect(M.statement([a, b])[0].running_cents).toBe(60);
  });

  it("money-sent stats: totals, fees, by month, by service (LBH portal payments grouped)", () => {
    const portal = e({ direction: "in", amount_cents: 5000, source: "lbh_payment", occurred_on: "2026-09-10" });
    const s = M.sentStats([...entries, portal], "2026-11", 3);
    expect(s.total_cents).toBe(65000);
    expect(s.transfers).toBe(2);
    expect(s.fees_cents).toBe(1800);
    expect(s.by_month).toEqual([
      { month: "2026-09", cents: 5000 },
      { month: "2026-10", cents: 60000 },
      { month: "2026-11", cents: 0 },
    ]);
    expect(s.by_service.map((x) => x.service)).toEqual(["mukuru", "lbh_portal"]);
  });

  it("months roll over the year correctly", () => {
    expect(M.sentStats([], "2026-01", 3).by_month.map((m) => m.month)).toEqual(["2025-11", "2025-12", "2026-01"]);
  });
});

describe("Build Account budgets and alerts", () => {
  const prices: M.PriceItem[] = [
    { id: "p1", item: "SAMPLE Cement 50kg bag", unit: "bag", area: "Harare", price_cents: 1150 },
    { id: "p2", item: "Common bricks", unit: "1000", area: "Harare", price_cents: 9500 },
  ];

  it("stage budget: over only when spent > budget", () => {
    const es = [e({ amount_cents: 1000, stage_name: "Slab" }), e({ amount_cents: 500, stage_name: "Slab" }), e({ direction: "in", amount_cents: 9, stage_name: "Slab" })];
    const b = M.stageBudgets(es, ["Slab", "Roof"], { Slab: 1500, Roof: 10 });
    expect(b[0]).toEqual({ stage: "Slab", budget_cents: 1500, spent_cents: 1500, over: false });
    expect(M.stageBudgets([...es, e({ amount_cents: 1, stage_name: "Slab" })], ["Slab"], { Slab: 1500 })[0].over).toBe(true);
    expect(M.stageBudgets(es, ["Foundation"], {})[0]).toEqual({ stage: "Foundation", budget_cents: null, spent_cents: 0, over: false });
  });

  it("price check matches by words and allows 10% above the usual price", () => {
    expect(M.matchPrice("Cement 50kg", prices)?.id).toBe("p1");
    expect(M.matchPrice("Roofing sheets", prices)).toBeNull();
    const ok = e({ items: [{ name: "Cement", qty: 10, unit_cents: 1265 }] }); // exactly +10%
    const high = e({ items: [{ name: "cement bags", qty: 10, total_cents: 13500 }] }); // 1350 each
    expect(M.priceWarnings([ok], prices)).toHaveLength(0);
    const w = M.priceWarnings([high], prices);
    expect(w).toEqual([{ entry_id: high.id, item: "cement bags", paid_cents: 1350, usual_cents: 1150, unit: "bag", area: "Harare" }]);
  });

  it("money in is never price-checked", () => {
    expect(M.priceWarnings([e({ direction: "in", items: [{ name: "cement", unit_cents: 99999 }] })], prices)).toHaveLength(0);
  });

  it("alerts: no receipt, price, over budget, family money not backed by receipts", () => {
    const accounts: M.BaAccount[] = [
      { id: "lbh", name: "LBH", kind: "lbh", holder_member_id: null },
      { id: "fam", name: "Brother", kind: "family", holder_member_id: "m1" },
    ];
    const es = [
      e({ account_id: "fam", direction: "in", amount_cents: 20000 }),
      e({ account_id: "fam", direction: "out", amount_cents: 5000, receipt_path: "ba/o/r.jpg", stage_name: "Slab" }),
      e({ account_id: "fam", direction: "out", amount_cents: 13500, description: "Cement", items: [{ name: "cement", qty: 10, total_cents: 13500 }], stage_name: "Slab" }),
      e({ account_id: "lbh", direction: "out", amount_cents: 700, receipt_source: "lbh", source: "lbh_purchase" }),
    ];
    const budgets = M.stageBudgets(es, ["Slab"], { Slab: 10000 });
    const kinds = M.alerts(es, accounts, prices, budgets).map((a) => a.kind);
    expect(kinds).toEqual(["no_receipt", "price", "over_budget", "unbacked"]);
    expect(M.unbackedFamilyMoney(es, accounts)).toEqual([{ account_id: "fam", name: "Brother", unbacked_cents: 15000 }]);
  });
});

describe("receipt reading", () => {
  it("reads shop, day-first date, items with quantities and the total", () => {
    const r = parseReceiptText(`HARDWARE CITY
Tel 0242 000000
Date: 03/11/2026
Cement 50kg 10 x 12.50 125.00
Brick force 3.20
Sub Total 128.20
VAT 0.00
TOTAL 128.20
Thank you`);
    expect(r.shop).toBe("HARDWARE CITY");
    expect(r.date).toBe("2026-11-03");
    expect(r.total_cents).toBe(12820);
    expect(r.items[0]).toMatchObject({ qty: 10, unit_cents: 1250, total_cents: 12500 });
    expect(r.items.some((i) => i.total_cents === 320)).toBe(true);
  });

  it("copes with unreadable text", () => {
    expect(parseReceiptText("")).toEqual({ shop: "", date: null, items: [], total_cents: null });
  });
});

describe("Build Account plans (free / paid / expired)", () => {
  const now = new Date("2026-11-08T12:00:00Z");
  const sub = (p: Partial<{ override: "free" | "paid" | "expired" | null; override_until: string | null; paid_until: string | null }>) => ({
    override: null,
    override_until: null,
    paid_until: null,
    ...p,
  });

  it("free automatically with a construction build", () => {
    expect(planOf(null, true, now)).toBe("free");
    expect(planOf(sub({ paid_until: "2020-01-01T00:00:00Z" }), true, now)).toBe("free");
  });
  it("no plan when nothing is set", () => expect(planOf(null, false, now)).toBe("none"));
  it("paid until the end date, then expired (read-only)", () => {
    expect(planOf(sub({ paid_until: "2026-12-01T00:00:00Z" }), false, now)).toBe("paid");
    expect(planOf(sub({ paid_until: "2026-11-01T00:00:00Z" }), false, now)).toBe("expired");
  });
  it("admin override wins", () => {
    expect(planOf(sub({ override: "free" }), false, now)).toBe("free");
    expect(planOf(sub({ override: "expired" }), true, now)).toBe("expired");
    expect(planOf(sub({ override: "paid" }), false, now)).toBe("paid");
    expect(planOf(sub({ override: "paid", override_until: "2026-11-01T00:00:00Z" }), false, now)).toBe("expired");
  });
  it("only free and paid can add", () => {
    expect([isWritable("free"), isWritable("paid"), isWritable("expired"), isWritable("none")]).toEqual([true, true, false, false]);
  });
});
