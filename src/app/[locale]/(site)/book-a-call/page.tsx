import ReplyPromise from "@/components/site/OfficeStatus";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import Photo from "@/components/site/Photo";
import { PHOTOS } from "@/config/photos";
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
  const tw = useTranslations("site.ws");
  return (
    <div className="ds-wrap pt-6 pb-14 md:pt-12">
      <div className="grid gap-8 md:grid-cols-12 md:gap-14">
        <div className="md:col-span-5">
          <h1 className="font-serif text-[2.25rem] leading-[0.95] font-extrabold tracking-[-0.035em] md:text-[3.25rem]">{tw("bookTitle")}</h1>
          <div className="relative mt-4 h-[170px] overflow-hidden rounded-[24px] md:h-[320px]">
            <Photo photo={PHOTOS.book} sizes="(min-width: 768px) 40vw, 100vw" priority className="absolute inset-0" stockLabel="" hideCredit />
          </div>
          <p className="mt-4 text-[15px] text-slate">{t("intro")}</p>
          <div className="mt-5">
            <ReplyPromise />
          </div>
        </div>
        <div className="md:col-span-7">
          <BookCallForm defaults={defaults} />
        </div>
      </div>
    </div>
  );
}

export default async function BookACallPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ service?: string }>;
}) {
  const { locale } = await params;
  const { service } = await searchParams;
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
  if (service && ["land", "materials", "monitoring", "camera", "not-sure"].includes(service)) defaults.service = service;
  return <BookContent defaults={defaults} />;
}
