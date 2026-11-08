import "server-only";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { baContext, loadBa, sendRenewalReminders, sharedWithMe, syncFromLbh, type BaContext, type BaData } from "./server";

export interface BaPage {
  viewerId: string;
  ctx: BaContext;
  data: BaData;
  shared: Awaited<ReturnType<typeof sharedWithMe>>;
  /** query string that keeps the selected Build Account (?owner=…) */
  ownerQs: string;
  writable: boolean;
  canAddTo: (accountId: string) => boolean;
}

/** Load one Build Account screen for the signed-in client. */
export async function loadBaPage(locale: string, ownerParam?: string): Promise<BaPage> {
  const { supabase, user } = await requireRole(locale, ["client"]);
  const ctx = await baContext(supabase, user.id, ownerParam);
  if (!ctx) notFound();
  if (ctx.isOwner) {
    await syncFromLbh(ctx.ownerId);
    await sendRenewalReminders([ctx.ownerId]).catch(() => 0);
  }
  const [data, shared] = await Promise.all([loadBa(supabase, ctx), sharedWithMe(supabase, user.id)]);
  const writable = data.plan === "free" || data.plan === "paid";
  // Family members add receipts only on the account they hold
  const held = ctx.member ? data.accounts.filter((a) => a.holder_member_id === ctx.member!.id).map((a) => a.id) : [];
  return {
    viewerId: user.id,
    ctx,
    data,
    shared,
    ownerQs: ctx.isOwner ? "" : `?owner=${ctx.ownerId}`,
    writable,
    canAddTo: (accountId) => writable && (ctx.isOwner || (ctx.member?.role === "add" && held.includes(accountId))),
  };
}
