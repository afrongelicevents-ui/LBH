/**
 * Build Account plan rules (mirror of the database's ba_plan, kept pure for tests and admin lists).
 *   1. admin override free / expired wins
 *   2. admin override paid counts until its end date (none = open-ended)
 *   3. a client with a construction build (not cancelled) is free
 *   4. a paid plan counts until paid_until; after that it is expired (read-only, never deleted)
 *   5. otherwise: no plan yet
 */
export type Plan = "free" | "paid" | "expired" | "none";

export interface PlanInput {
  override: "free" | "paid" | "expired" | null;
  override_until: string | null;
  paid_until: string | null;
}

export function planOf(p: PlanInput | null, hasBuild: boolean, now = new Date()): Plan {
  const t = now.getTime();
  const sub: PlanInput = p ?? { override: null, override_until: null, paid_until: null };
  if (sub.override === "free") return "free";
  if (sub.override === "expired") return "expired";
  if (sub.override === "paid" && (!sub.override_until || new Date(sub.override_until).getTime() > t)) return "paid";
  if (hasBuild) return "free";
  if (sub.paid_until && new Date(sub.paid_until).getTime() > t) return "paid";
  if (sub.paid_until || sub.override === "paid") return "expired";
  return "none";
}

export const isWritable = (plan: Plan) => plan === "free" || plan === "paid";
