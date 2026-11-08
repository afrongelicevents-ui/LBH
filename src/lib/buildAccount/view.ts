import type { BaAccount, BaEntry } from "./math";
import type { BaContext, BaData } from "./server";

/** Who confirms money "on its way" into this account. */
export function receiverOf(account: BaAccount | undefined, ctx: BaContext): "me" | "lbh" | "member" | "owner" {
  if (!account || account.kind === "lbh") return "lbh";
  if (account.holder_member_id) return ctx.member?.id === account.holder_member_id ? "me" : "member";
  return ctx.isOwner ? "me" : "owner";
}

export function accountName(data: BaData, id: string): string {
  return (data.accounts.find((a) => a.id === id)?.name ?? "").replace(/^SAMPLE\s+/, "");
}

export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function sourceLabelKey(e: BaEntry): string {
  return e.source.startsWith("lbh_") ? "fromLbh" : e.source === "scan" ? "scanned" : "manual";
}
