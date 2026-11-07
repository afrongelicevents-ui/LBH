import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import SectionTitle from "@/components/SectionTitle";
import BookCallForm, { type BookingDefaults } from "@/components/BookCallForm";
import { getUserProfile } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "bookPage" });
  return { title: t("metaTitle") };
}

function BookContent({ defaults }: { defaults: BookingDefaults }) {
  const t = useTranslations("bookPage");
  return (
    <div className="bg-offwhite py-12 md:py-16">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        <SectionTitle as="h1">{t("title")}</SectionTitle>
        <p className="mt-6 text-center text-base text-muted md:text-lg">
          {t("intro")}
        </p>
        <div className="mt-10">
          <BookCallForm defaults={defaults} />
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
  // Signed-in clients: prefill their details (a booking is matched to the
  // account by email).
  const { profile } = await getUserProfile();
  const defaults: BookingDefaults =
    profile?.role === "client"
      ? {
          name: profile.full_name,
          email: profile.email,
          whatsapp: profile.whatsapp ?? "",
          country: profile.country ?? "",
        }
      : {};
  return <BookContent defaults={defaults} />;
}
