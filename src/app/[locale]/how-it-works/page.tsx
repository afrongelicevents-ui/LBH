import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import SectionTitle from "@/components/SectionTitle";
import { ArrowRightIcon, ShieldCheckIcon } from "@/components/icons";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "howPage" });
  return { title: t("metaTitle") };
}

const stages = [1, 2, 3, 4, 5, 6, 7] as const;

function HowContent() {
  const t = useTranslations();

  return (
    <div className="bg-offwhite py-12 md:py-16">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <SectionTitle as="h1">{t("howPage.title")}</SectionTitle>
        <p className="mt-6 text-center text-base text-muted md:text-lg">
          {t("howPage.intro")}
        </p>

        <ol className="mt-10 space-y-0">
          {stages.map((n, idx) => (
            <li key={n} className="relative flex gap-5 pb-8 last:pb-0">
              {/* connector line */}
              {idx < stages.length - 1 && (
                <span
                  aria-hidden
                  className="absolute top-12 left-6 h-[calc(100%-3rem)] w-px bg-line"
                />
              )}
              <span className="z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-forest text-lg font-extrabold text-white">
                {n}
              </span>
              <div className="card flex-1 p-5">
                <h2 className="text-lg font-bold text-forest">
                  {t(`howPage.stage${n}Title`)}
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted md:text-base">
                  {t(`howPage.stage${n}Text`)}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-10 flex items-start gap-3 rounded-2xl border border-gold/50 bg-white p-5">
          <ShieldCheckIcon width={26} height={26} className="mt-0.5 shrink-0 text-gold" />
          <p className="text-sm leading-relaxed text-ink md:text-base">
            {t("howPage.note")}
          </p>
        </div>

        <div className="mt-10 text-center">
          <Link href="/book-a-call" className="btn btn-gold px-7">
            {t("common.bookFirstCall")}
            <ArrowRightIcon width={20} height={20} />
          </Link>
        </div>
      </div>
    </div>
  );
}

export default async function HowItWorksPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <HowContent />;
}
