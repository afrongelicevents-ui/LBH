import { getUserProfile } from "@/lib/supabase/server";
import { emptySections, loadAccount } from "@/lib/account/data";

/** Which account sections have nothing yet (so the menu can hide them). Signed-in customers only. */
export async function GET() {
  const { supabase, profile } = await getUserProfile();
  if (!profile || profile.role !== "client") return Response.json({ hidden: [] }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
  const hidden = emptySections(await loadAccount(supabase));
  return Response.json({ hidden }, { headers: { "Cache-Control": "private, no-store" } });
}
