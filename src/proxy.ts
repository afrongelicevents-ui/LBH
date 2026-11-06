import createIntlMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const intl = createIntlMiddleware(routing);

/**
 * Proxy (middleware): next-intl locale handling + Supabase session refresh,
 * so server components always see a fresh auth token.
 */
export default async function proxy(request: NextRequest) {
  const response = intl(request);

  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );
    // Touch the session so expired access tokens get refreshed.
    await supabase.auth.getUser();
  }

  return response;
}

export const config = {
  // Skip API routes, Next internals and all static files
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
