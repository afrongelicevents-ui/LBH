import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import GroupPage from "@/components/ws/GroupPage";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "site.ws.build" });
  return { title: t("title"), description: t("lead") };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <GroupPage group="build" />;
}
