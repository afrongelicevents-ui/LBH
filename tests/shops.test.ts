import { describe, expect, it } from "vitest";
import { newOrderCode, settleOrder, slugify } from "@/lib/shops";

const line = (price: number, shelf: number | null = null, available = true, qty = 2) => ({ qty, price_cents: price, shelf_price_cents: shelf, available });

describe("LBH Shops", () => {
  it("makes readable order codes", () => {
    const codes = new Set(Array.from({ length: 200 }, newOrderCode));
    for (const c of codes) expect(c).toMatch(/^LBH-[A-HJ-NP-Z2-9]{6}$/);
    expect(codes.size).toBeGreaterThan(195);
  });

  it("same price: buy at the locked price", () => {
    expect(settleOrder([line(1000), line(500)])).toEqual({ pay: 3000, cheaper: false, needsClient: false });
  });

  it("lower shelf price: the client pays less and the shop is flagged", () => {
    expect(settleOrder([line(1000, 900), line(500)])).toEqual({ pay: 2800, cheaper: true, needsClient: false });
  });

  it("higher price or a missing item: the client decides first", () => {
    expect(settleOrder([line(1000, 1100)]).needsClient).toBe(true);
    expect(settleOrder([line(1000), line(500, null, false)]).needsClient).toBe(true);
  });

  it("slugs shop names", () => {
    expect(slugify("Harare Hardware & Co.")).toBe("harare-hardware-co");
    expect(slugify("!!")).toMatch(/^shop-/);
  });
});
