import type { Metadata, Viewport } from "next";
import { DM_Sans, Playfair_Display } from "next/font/google";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { site } from "@/config/site";
import "../globals.css";

/** Warm Sand type: DM Sans for text, Playfair Display for headings. */
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

/**
 * Light / dark before the first paint (no flash): the saved choice from the
 * theme toggle, otherwise the phone's setting.
 */
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("lbh-theme");var d=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light";}catch(e){}})();`;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "common" });
  return {
    metadataBase: new URL(site.url),
    title: {
      default: `${site.shortName} — ${t("brand")}`,
      template: `%s · ${site.shortName}`,
    },
    description: t("tagline"),
    // what WhatsApp, Facebook and others show when the site is shared
    openGraph: {
      type: "website",
      siteName: site.name,
      title: `${site.shortName} — ${t("brand")}`,
      description: t("tagline"),
      locale: locale === "en" ? "en_GB" : locale === "sn" ? "sn_ZW" : "nd_ZW",
      images: [{ url: "/images/site/share.jpg", width: 1200, height: 630, alt: site.name }],
    },
    twitter: { card: "summary_large_image" },
    manifest: "/manifest.webmanifest",
    icons: {
      icon: [{ url: "/icons/ws-icon-192.png", sizes: "192x192", type: "image/png" }],
      apple: [{ url: "/icons/ws-icon-192.png" }],
    },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F1ECE5" },
    { media: "(prefers-color-scheme: dark)", color: "#17120E" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  return (
    <html lang={locale} className={`${dmSans.variable} ${playfair.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-screen flex-col antialiased">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
