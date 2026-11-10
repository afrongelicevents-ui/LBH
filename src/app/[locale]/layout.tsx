import type { Metadata, Viewport } from "next";
import { Inter_Tight, Source_Serif_4 } from "next/font/google";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { site } from "@/config/site";
import "../globals.css";

const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

/** Editorial serif for headings only (body text stays Inter Tight). */
const serif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

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
      images: [{ url: "/images/hero.jpg", alt: site.name }],
    },
    twitter: { card: "summary_large_image" },
    manifest: "/manifest.webmanifest",
    icons: {
      icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      apple: [{ url: "/icons/icon-192.png" }],
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#163A2B",
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
    <html lang={locale} className={`${interTight.variable} ${serif.variable}`}>
      <body className="flex min-h-screen flex-col antialiased">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
