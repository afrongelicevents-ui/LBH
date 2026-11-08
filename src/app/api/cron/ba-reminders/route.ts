import { timingSafeEqual } from "node:crypto";
import { sendRenewalReminders } from "@/lib/buildAccount/server";

/** Daily (Vercel Cron): email Build Account renewal reminders. Needs CRON_SECRET. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const got = req.headers.get("authorization") ?? "";
  const want = `Bearer ${secret ?? ""}`;
  if (!secret || got.length !== want.length || !timingSafeEqual(Buffer.from(got), Buffer.from(want))) {
    return new Response("not authorised", { status: 401 });
  }
  const sent = await sendRenewalReminders();
  return Response.json({ sent });
}
