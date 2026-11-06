import { redirect } from "@/i18n/navigation";
import { getUserProfile, type UserRole } from "@/lib/supabase/server";
import { homeForRole, requiresMfa } from "./roles";

/**
 * Server-side role guard for portal layouts.
 * - no session → /login
 * - staff without AAL2 → forced to /mfa (2FA required, brief §11)
 * - wrong area → their own home
 */
export async function requireRole(locale: string, roles: UserRole[]) {
  const { supabase, user, profile, aal } = await getUserProfile();

  if (!user || !profile) {
    redirect({ href: "/login", locale });
    throw new Error("unreachable");
  }
  if (requiresMfa(profile.role) && aal !== "aal2") {
    redirect({ href: "/mfa", locale });
  }
  if (!roles.includes(profile.role)) {
    redirect({ href: homeForRole(profile.role), locale });
  }
  return { supabase, user, profile };
}
