import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "howPage" });
  return { title: t("metaTitle"), description: t("intro") };
}

const STAGES = [1, 2, 3, 4, 5, 6, 7] as const;

/** How it works — the full journey, one numbered step per row. */
export default async function HowItWorksPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("howPage");
  const ts = await getTranslations("site");
  return (
    <div data-testid="how-page">
      <header className="border-b border-rule">
        <div className="ds-wrap py-14 md:py-20">
          <p className="ds-eyebrow">{ts("nav.howItWorks")}</p>
          <h1 className="ds-h2 mt-3 max-w-3xl md:text-[3.2rem]">{ts("howPage.title")}</h1>
          <p className="ds-lead mt-5 max-w-2xl">{t("intro")}</p>
        </div>
      </header>
      <div className="ds-wrap py-12 md:py-16">
        <ol className="md:grid md:grid-cols-12">
          <div className="md:col-span-9 md:col-start-2">
            {STAGES.map((n) => (
              <li key={n} className="grid grid-cols-[3.5rem_1fr] gap-4 border-b border-rule py-7 md:grid-cols-[6rem_1fr] md:py-9">
                <span className="font-serif text-4xl leading-none text-stone md:text-5xl">{n}</span>
                <div>
                  <h2 className="font-serif text-[1.45rem] leading-snug text-charcoal">{t(`stage${n}Title`)}</h2>
                  <p className="ds-body mt-2 max-w-2xl text-base">{t(`stage${n}Text`)}</p>
                </div>
              </li>
            ))}
          </div>
        </ol>
        <div className="mt-12 grid gap-8 md:grid-cols-12">
          <p className="border-l-2 border-forest pl-5 text-[15px] leading-relaxed text-charcoal md:col-span-7 md:col-start-2">{t("note")}</p>
          <div className="md:col-span-3 md:col-start-10">
            <Link href="/book-a-call" className="ds-btn ds-btn-primary w-full">{ts("bookConsultation")}</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
