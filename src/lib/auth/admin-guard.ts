import "server-only";
import { getUserProfile } from "@/lib/supabase/server";

/**
 * Guard for admin server actions and API routes: role admin AND AAL2
 * (2FA completed this session — brief §11).
 */
export async function requireAdminAction() {
  const { supabase, user, profile, aal } = await getUserProfile();
  if (!user || !profile || profile.role !== "admin" || aal !== "aal2") {
    throw new Error("not authorised");
  }
  return { supabase, user, profile };
}

/** Same for field staff actions. */
export async function requireFieldAction() {
  const { supabase, user, profile, aal } = await getUserProfile();
  if (!user || !profile || profile.role !== "field" || aal !== "aal2") {
    throw new Error("not authorised");
  }
  return { supabase, user, profile };
}
