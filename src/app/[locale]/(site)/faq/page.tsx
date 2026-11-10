import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "site.faq" });
  return { title: t("metaTitle"), description: t("intro") };
}

const QUESTIONS = ["what", "there", "cost", "pay", "money", "proof", "family", "mistake", "privacy", "languages"] as const;

/** Frequently asked questions — answers use only what LBH does today. */
export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("site.faq");
  const ts = await getTranslations("site");
  return (
    <div data-testid="faq-page">
      <header className="border-b border-rule">
        <div className="ds-wrap py-14 md:py-20">
          <p className="ds-eyebrow">{ts("nav.faq")}</p>
          <h1 className="ds-h2 mt-3 max-w-3xl md:text-[3.2rem]">{t("title")}</h1>
          <p className="ds-lead mt-5 max-w-2xl">{t("intro")}</p>
        </div>
      </header>
      <div className="ds-wrap grid gap-10 py-12 md:grid-cols-12 md:py-16">
        <div className="md:col-span-8">
          {QUESTIONS.map((q) => (
            <details key={q} className="group border-b border-rule first:border-t" data-testid="faq-item">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-5 font-serif text-[1.2rem] leading-snug text-charcoal hover:text-forest [&::-webkit-details-marker]:hidden">
                {t(`${q}.q`)}
                <span aria-hidden className="mt-1 shrink-0 text-xl text-forest transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="ds-body max-w-2xl pb-6 text-base">{t(`${q}.a`)}</p>
            </details>
          ))}
        </div>
        <aside className="md:col-span-3 md:col-start-10">
          <h2 className="font-serif text-xl">{t("moreTitle")}</h2>
          <p className="ds-body mt-2 text-sm">{t("moreText")}</p>
          <Link href="/book-a-call" className="ds-btn ds-btn-primary mt-5 w-full">{ts("bookConsultation")}</Link>
          <Link href="/contact" className="ds-link mt-4 inline-block text-sm">{ts("nav.contact")}</Link>
        </aside>
      </div>
    </div>
  );
}
