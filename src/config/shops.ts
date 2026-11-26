/** Material categories for LBH Shops (labels: shops.cat.<key>). Same list as the database check. */
export const SHOP_CATEGORIES = [
  "cement",
  "bricks",
  "sand_stone",
  "steel",
  "roofing",
  "timber",
  "plumbing",
  "electrical",
  "paint",
  "tiles",
  "doors_windows",
  "hardware",
] as const;
export type ShopCategory = (typeof SHOP_CATEGORIES)[number];

export const SHOP_ORDER_STATUSES = ["placed", "assigned", "changed", "bought", "cancelled"] as const;
export type ShopOrderStatus = (typeof SHOP_ORDER_STATUSES)[number];

/** One shop per order; at most this many lines. */
export const SHOP_ORDER_MAX_LINES = 40;
