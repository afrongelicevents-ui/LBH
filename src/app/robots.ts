import type { MetadataRoute } from "next";
import { site } from "@/config/site";

const PRIVATE = ["/portal", "/admin", "/field", "/api/", "/mfa", "/account", "/pay", "/auth", "/build-account/join"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // private areas, in every language
      disallow: PRIVATE.flatMap((p) => [p, `/sn${p}`, `/nd${p}`]),
    },
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
