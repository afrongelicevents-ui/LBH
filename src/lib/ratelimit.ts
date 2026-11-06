import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * DB-backed rate limiter (works across serverless instances).
 * Buckets are keyed by action + hashed client IP; counts live in the
 * rate_limits table behind the rate_limit_hit() function.
 */
export async function rateLimited(
  action: string,
  max: number,
  windowSeconds: number
): Promise<boolean> {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown";
  const ipHash = createHash("sha256").update(ip).digest("hex").slice(0, 24);
  const bucket = `${action}:${ipHash}`;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("rate_limit_hit", {
      p_bucket: bucket,
      p_max: max,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.error(`[ratelimit] ${error.message}`);
      return false; // fail open: availability over strictness for public forms
    }
    return Boolean(data);
  } catch {
    return false;
  }
}
