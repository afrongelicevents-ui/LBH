import { timingSafeEqual } from "node:crypto";
import { deleteUnsavedReceipts, sendRenewalReminders } from "@/lib/buildAccount/server";

/** Daily (Vercel Cron): renewal reminders + delete receipt photos never saved (24 h). Needs CRON_SECRET. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const got = req.headers.get("authorization") ?? "";
  const want = `Bearer ${secret ?? ""}`;
  if (!secret || got.length !== want.length || !timingSafeEqual(Buffer.from(got), Buffer.from(want))) {
    return new Response("not authorised", { status: 401 });
  }
  const sent = await sendRenewalReminders();
  const receiptsDeleted = await deleteUnsavedReceipts().catch((e) => {
    console.error(`[build-account] receipt clean-up: ${e instanceof Error ? e.message : e}`);
    return 0;
  });
  return Response.json({ sent, receiptsDeleted });
}
