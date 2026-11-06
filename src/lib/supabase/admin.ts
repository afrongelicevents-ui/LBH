import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client — bypasses RLS. Server-only ("server-only" import makes
 * bundling into client code a build error). Use ONLY for:
 *   - public booking form (creates enquiry + account by email)
 *   - notify-me interest
 *   - Paynow result webhook
 *   - storage uploads/signed URLs after explicit access checks
 * Everything user-facing goes through the RLS-bound clients instead.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
