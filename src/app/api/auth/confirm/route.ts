import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/signup";

// Links from the LBH-branded auth emails, and the page each one opens.
// Reset and invite links always open "choose your password"; the others go
// to the (safe, same-site) page named in ?next=, normally the account.
const FIXED_TARGET: Partial<Record<EmailOtpType, string>> = {
  recovery: "/account/password",
  invite: "/account/password",
};
const TYPES: EmailOtpType[] = ["email", "signup", "recovery", "invite", "magiclink", "email_change"];

/**
 * Link from an auth email (confirm sign-up, reset password, invite, magic
 * link, change email) → verify the one-time token, start the session, and
 * open the right page. Works on any device (no PKCE cookie needed).
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const asked = safeNextPath(url.searchParams.get("next"));
  const locale = /^\/(en|sn|nd)(\/|$)/.exec(asked)?.[1] ?? "en";
  const fixed = type ? FIXED_TARGET[type] : undefined;
  const next = fixed ? `${locale === "en" ? "" : `/${locale}`}${fixed}` : asked;
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
  if (ok && !fixed) target.searchParams.set("welcome", "1");
  return NextResponse.redirect(target);
}
