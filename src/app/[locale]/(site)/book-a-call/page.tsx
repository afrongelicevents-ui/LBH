import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import SectionTitle from "@/components/SectionTitle";
import BookCallForm from "@/components/BookCallForm";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "bookPage" });
  return { title: t("metaTitle") };
}

function BookContent() {
  const t = useTranslations("bookPage");
  return (
    <div className="bg-offwhite py-12 md:py-16">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        <SectionTitle as="h1">{t("title")}</SectionTitle>
        <p className="mt-6 text-center text-base text-muted md:text-lg">
          {t("intro")}
        </p>
        <div className="mt-10">
          <BookCallForm />
        </div>
      </div>
    </div>
  );
}

export default async function BookACallPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <BookContent />;
}
