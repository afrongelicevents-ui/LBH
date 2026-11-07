import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/** Per-request Supabase client bound to the user's auth cookies (RLS applies). */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — session refresh is handled
            // by the proxy middleware, safe to ignore here.
          }
        },
      },
    }
  );
}

export type UserRole = "client" | "field" | "admin";

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  email: string;
  whatsapp: string | null;
  country: string | null;
  locale: string;
  /** field staff only: which portal they see */
  staff_kind: "field_agent" | "lawyer" | null;
}

/** Authenticated user + profile, or nulls. Uses getUser() (server-verified). */
export async function getUserProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null, aal: null as string | null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, full_name, email, whatsapp, country, locale, staff_kind")
    .eq("id", user.id)
    .single();

  // aal claim comes from the session JWT (identity above is server-verified)
  const {
    data: { session },
  } = await supabase.auth.getSession();
  let aal: string | null = null;
  if (session?.access_token) {
    try {
      const payload = JSON.parse(
        Buffer.from(session.access_token.split(".")[1], "base64url").toString()
      );
      aal = payload.aal ?? null;
    } catch {
      aal = null;
    }
  }

  return { supabase, user, profile: (profile as Profile | null) ?? null, aal };
}
