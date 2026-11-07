import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

// The browser talks to Supabase directly (auth, realtime chat) and loads
// signed storage URLs from it, so its origin must be allowed explicitly.
const supabaseOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return "";
  }
})();
const supabaseWs = supabaseOrigin.replace(/^http/, "ws");

const isDev = process.env.NODE_ENV !== "production";

/**
 * Security headers (brief §11). Next.js needs 'unsafe-inline' for its
 * bootstrap script and style tags; everything else is an explicit allowlist.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabaseOrigin} https://tile.openstreetmap.org`,
  `media-src 'self' blob: ${supabaseOrigin}`,
  "font-src 'self'",
  `connect-src 'self' ${supabaseOrigin} ${supabaseWs}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
]
  .map((d) => d.replace(/\s+/g, " ").trim())
  .join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    // Field staff take photos/videos (with sound) and GPS in the app (brief §6).
    key: "Permissions-Policy",
    value: "camera=(self), geolocation=(self), microphone=(self), payment=()",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    // Local development: Supabase runs on 127.0.0.1
    dangerouslyAllowLocalIP: /^https?:\/\/(127\.0\.0\.1|localhost)(:|$)/.test(supabaseOrigin),
    // Website photos chosen by the admin live in the public "site-photos" bucket
    remotePatterns: supabaseOrigin
      ? [
          {
            protocol: new URL(supabaseOrigin).protocol.replace(":", "") as "http" | "https",
            hostname: new URL(supabaseOrigin).hostname,
            port: new URL(supabaseOrigin).port,
            pathname: "/storage/v1/object/public/site-photos/**",
          },
        ]
      : [],
  },
  serverExternalPackages: ["pdfkit", "sharp"],
  experimental: {
    serverActions: {
      // Files never pass through server actions: the browser uploads them
      // straight to Supabase Storage (src/lib/useDirectUpload.ts), so forms
      // only carry small references. Kept below Vercel's 4.5 MB body cap.
      bodySizeLimit: "2mb",
    },
    proxyClientMaxBodySize: "2mb",
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
