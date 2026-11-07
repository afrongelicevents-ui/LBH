import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import SectionTitle from "@/components/SectionTitle";
import ContactForm from "@/components/ContactForm";
import { site, waLink } from "@/config/site";
import {
  MailIcon,
  WhatsAppIcon,
  CalendarIcon,
  ArrowRightIcon,
} from "@/components/icons";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contactPage" });
  return { title: t("metaTitle") };
}

function ContactContent() {
  const t = useTranslations("contactPage");
  const tc = useTranslations("common");

  return (
    <div className="bg-offwhite py-12 md:py-16">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <SectionTitle as="h1">{t("title")}</SectionTitle>
        <p className="mt-6 text-center text-base text-muted md:text-lg">
          {t("intro")}
        </p>

        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          <a
            href={waLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="card flex items-center gap-4 p-6 transition-shadow hover:shadow-(--shadow-card-hover)"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-whatsapp text-white">
              <WhatsAppIcon width={26} height={26} />
            </span>
            <span>
              <span className="block text-sm font-bold text-forest">
                {t("whatsappLabel")}
              </span>
              <span className="block text-sm text-muted">{tc("whatsapp")}</span>
            </span>
          </a>

          <a
            href={`mailto:${site.email}`}
            className="card flex items-center gap-4 p-6 transition-shadow hover:shadow-(--shadow-card-hover)"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-forest text-white">
              <MailIcon width={24} height={24} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-forest">
                {t("emailLabel")}
              </span>
              <span className="block truncate text-sm text-muted">{site.email}</span>
            </span>
          </a>
        </div>

        <ContactForm />

        <div className="card mt-8 flex flex-col items-center gap-4 p-7 text-center">
          <CalendarIcon width={32} height={32} className="text-forest" />
          <p className="max-w-md text-sm text-muted md:text-base">{t("orBook")}</p>
          <Link href="/book-a-call" className="btn btn-primary px-7">
            {tc("bookFirstCall")}
            <ArrowRightIcon width={20} height={20} />
          </Link>
        </div>
      </div>
    </div>
  );
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ContactContent />;
}
