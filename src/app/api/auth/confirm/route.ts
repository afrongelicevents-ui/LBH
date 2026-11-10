import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/signup";

// Only sign-up confirmation links start a session here.
const TYPES: EmailOtpType[] = ["email", "signup"];

/**
 * Email confirmation link → verify the one-time token, start the session,
 * and open the client portal. Works on any device (no PKCE cookie needed).
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNextPath(url.searchParams.get("next"));
  const locale = /^\/(en|sn|nd)(\/|$)/.exec(next)?.[1] ?? "en";
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const code = url.searchParams.get("code");

  const supabase = await createClient();
  let ok = false;
  if (tokenHash && type && TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    ok = !error;
    if (error) console.error(`[auth-confirm] ${error.message}`);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }

  const prefix = locale === "en" ? "" : `/${locale}`;
  let target = new URL(ok ? next : `${prefix}/login?confirm=failed`, url.origin);
  if (target.origin !== url.origin) target = new URL(`${prefix}/account`, url.origin);
  if (ok) target.searchParams.set("welcome", "1");
  return NextResponse.redirect(target);
}
