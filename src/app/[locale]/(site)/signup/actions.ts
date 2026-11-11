"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { signupSchema } from "@/lib/signup";
import { resolveCountry } from "@/lib/country";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimited } from "@/lib/ratelimit";
import { site } from "@/config/site";

/** Where Supabase's confirmation link sends the browser after verifying. */
function confirmRedirect(locale: string): string {
  const prefix = locale === "en" ? "" : `/${locale}`;
  return `${site.url}${prefix}/auth/callback?next=${prefix}/account`;
}

export type SignupResult =
  | { status: "ok" }
  | { status: "invalid"; field?: string }
  | { status: "exists" }
  | { status: "rate" }
  | { status: "error" };

/**
 * Client self sign-up. Always creates a CLIENT account: the role comes only
 * from app_metadata, which sign-up cannot set (staff stay invite-only).
 * The account works only after the email address is confirmed.
 *
 * - New email → Supabase sends the "Confirm your account" email.
 * - Email that booked a call (or started sign-up) but was never confirmed
 *   and never used → it is still a sign-up: the password and details are
 *   saved and the "Confirm your account" email is sent. The account only
 *   opens from that inbox, so nobody can use someone else's address.
 * - Email that already has a working account (or belongs to staff) →
 *   "exists": the visitor is told to log in or reset the password. No email
 *   is sent from here; a reset email only goes out when they ask for one.
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
  const details = {
    full_name: d.full_name,
    whatsapp: d.whatsapp,
    country: resolveCountry(d),
    locale: d.locale,
  };

  try {
    const admin = createAdminClient();
    const { data: existingId } = await admin.rpc("find_user_id_by_email", { p_email: d.email });

    if (existingId) {
      const { data: found } = await admin.auth.admin.getUserById(existingId as string);
      const user = found?.user;
      const { data: profile } = await admin.from("profiles").select("role").eq("id", existingId).maybeSingle();
      const unused = user && !user.email_confirmed_at && !user.last_sign_in_at;
      const isClient = (user?.app_metadata?.role ?? profile?.role ?? "client") === "client";
      if (!user || !unused || !isClient) return { status: "exists" };

      // Never confirmed, never used (e.g. created when they booked a call):
      // finish the sign-up and send the confirmation email.
      const { error: updErr } = await admin.auth.admin.updateUserById(user.id, {
        password: d.password,
        user_metadata: { ...user.user_metadata, ...details },
      });
      if (updErr) {
        console.error(`[signup] update pending account: ${updErr.message}`);
        if (/password/i.test(updErr.message)) return { status: "invalid", field: "password" };
        return { status: "error" };
      }
      await admin
        .from("profiles")
        .update({ full_name: details.full_name, whatsapp: details.whatsapp, country: details.country, locale: details.locale })
        .eq("id", user.id);
      const { error: sendErr } = await anon.auth.resend({
        type: "signup",
        email: d.email,
        options: { emailRedirectTo: confirmRedirect(d.locale) },
      });
      if (sendErr) {
        console.error(`[signup] confirmation email: ${sendErr.message}`);
        return /rate|too many|security purposes/i.test(sendErr.message) ? { status: "rate" } : { status: "error" };
      }
      return { status: "ok" };
    }

    const { data: created, error } = await anon.auth.signUp({
      email: d.email,
      password: d.password,
      options: {
        // the confirmation link verifies the email, then lands here
        emailRedirectTo: confirmRedirect(d.locale),
        data: details,
      },
    });
    if (error) {
      console.error(`[signup] ${error.message}`);
      if (/password/i.test(error.message)) return { status: "invalid", field: "password" };
      if (/rate|too many|security purposes/i.test(error.message)) return { status: "rate" };
      if (/already registered|already exists/i.test(error.message)) return { status: "exists" };
      return { status: "error" };
    }
    // Supabase answers a confirmed address with a user that has no identities
    // (and sends nothing): treat it as an existing account.
    if (created.user && created.user.identities?.length === 0) return { status: "exists" };
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

/** "Email me a reset link": the link works on any device (opens /account/password). */
export async function requestPasswordReset(email: string, locale: string): Promise<"ok" | "rate" | "error"> {
  const parsed = signupSchema.shape.email.safeParse(email);
  if (!parsed.success) return "error";
  if (await rateLimited("password-reset", 5, 3600)) return "rate";
  const loc = ["en", "sn", "nd"].includes(locale) ? locale : "en";
  const anon = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { error } = await anon.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${site.url}${loc === "en" ? "" : `/${loc}`}/account/password`,
  });
  if (error) console.error(`[password-reset] ${error.message}`);
  // Same answer whether or not the email has an account
  return error && /rate|too many/i.test(error.message) ? "rate" : "ok";
}
