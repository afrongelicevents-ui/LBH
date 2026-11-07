"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { signupSchema } from "@/lib/signup";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimited } from "@/lib/ratelimit";
import { site } from "@/config/site";

/** Where Supabase's confirmation link sends the browser after verifying. */
function confirmRedirect(locale: string): string {
  const prefix = locale === "en" ? "" : `/${locale}`;
  return `${site.url}${prefix}/auth/callback?next=${prefix}/portal`;
}

export type SignupResult =
  | { status: "ok" }
  | { status: "invalid"; field?: string }
  | { status: "rate" }
  | { status: "error" };

/**
 * Client self sign-up. Always creates a CLIENT account: the role comes only
 * from app_metadata, which sign-up cannot set (staff stay invite-only).
 * The account works only after the email address is confirmed.
 *
 * Whether or not the email already has an account, the visitor sees the
 * same "check your inbox" answer (no account discovery). An existing
 * account gets a password-reset email instead, so nobody can set a
 * password on someone else's account.
 */
export async function signUpClient(
  _prev: SignupResult | null,
  formData: FormData
): Promise<SignupResult> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { status: "invalid", field: first?.path?.[0]?.toString() };
  }
  if (raw.website) return { status: "ok" }; // honeypot

  if (await rateLimited("signup", 5, 3600)) return { status: "rate" };

  const d = parsed.data;
  const anon = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  try {
    const { data: existingId } = await createAdminClient().rpc("find_user_id_by_email", {
      p_email: d.email,
    });
    if (existingId) {
      await anon.auth.resetPasswordForEmail(d.email, {
        redirectTo: `${site.url}${d.locale === "en" ? "" : `/${d.locale}`}/account/password`,
      });
      return { status: "ok" };
    }

    const { error } = await anon.auth.signUp({
      email: d.email,
      password: d.password,
      options: {
        // Supabase's confirmation link verifies the email, then lands here
        emailRedirectTo: confirmRedirect(d.locale),
        data: {
          full_name: d.full_name,
          whatsapp: d.whatsapp,
          country: d.country,
          locale: d.locale,
        },
      },
    });
    if (error) {
      console.error(`[signup] ${error.message}`);
      if (/password/i.test(error.message)) return { status: "invalid", field: "password" };
      if (/rate|too many/i.test(error.message)) return { status: "rate" };
      return { status: "error" };
    }
    return { status: "ok" };
  } catch (e) {
    console.error(`[signup] ${e instanceof Error ? e.message : e}`);
    return { status: "error" };
  }
}

/** "Send the confirmation email again" from the login page. */
export async function resendConfirmation(email: string, locale: string): Promise<"ok" | "rate" | "error"> {
  const parsed = signupSchema.shape.email.safeParse(email);
  const loc = ["en", "sn", "nd"].includes(locale) ? locale : "en";
  if (!parsed.success) return "error";
  if (await rateLimited("signup-resend", 5, 3600)) return "rate";
  const anon = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { error } = await anon.auth.resend({
    type: "signup",
    email: parsed.data,
    options: { emailRedirectTo: confirmRedirect(loc) },
  });
  if (error) console.error(`[signup-resend] ${error.message}`);
  return error && /rate|too many/i.test(error.message) ? "rate" : "ok";
}
