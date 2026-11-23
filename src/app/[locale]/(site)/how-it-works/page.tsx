import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "howPage" });
  return { title: t("metaTitle"), description: t("intro") };
}

const STEPS = [1, 2, 3, 4, 5, 6] as const;

/** How it works (Warm Sand): 6 steps, ways to pay, questions. No prices. */
export default async function HowItWorksPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("site.ws");
  const ts = await getTranslations("site");
  return (
    <div data-testid="how-page">
      <div className="ds-wrap pt-6 md:pt-12">
        <h1 className="font-serif text-[2.25rem] leading-[0.95] font-extrabold tracking-[-0.035em] md:text-[3.5rem]">{t("howTitle")}</h1>
        <p className="ws-lede mt-3 max-w-2xl">{t("howIntro")}</p>
      </div>

      <div className="ds-wrap grid gap-12 pt-6 pb-10 md:grid-cols-12 md:gap-14 md:pt-10">
        <ol className="ws-how md:col-span-7" data-testid="how-steps">
          {STEPS.map((n) => (
            <li key={n}>
              <span className="n">{n}</span>
              <div>
                <b>{t(`how.s${n}t`)}</b>
                <span className="d">{t(`how.s${n}`)}</span>
              </div>
            </li>
          ))}
        </ol>

        <div className="space-y-10 md:col-span-5">
          <section aria-labelledby="pay">
            <h2 id="pay" className="text-[1.5rem] font-extrabold">{t("payTitle")}</h2>
            <dl className="mt-3 border-t border-rule">
              {(["card", "mobile", "abroad"] as const).map((k) => (
                <div key={k} className="border-b border-rule py-3.5">
                  <dt className="text-base font-bold">{t(`pay.${k}T`)}</dt>
                  <dd className="text-sm text-slate">{t(`pay.${k}`)}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby="faq">
            <h2 id="faq" className="text-[1.5rem] font-extrabold">{t("faqTitle")}</h2>
            <div className="mt-2 border-t border-rule">
              {[1, 2, 3, 4].map((n) => (
                <details key={n} className="ws-faq">
                  <summary>{t(`faq.q${n}`)}</summary>
                  <p>{t(`faq.a${n}`)}</p>
                </details>
              ))}
            </div>
            <Link href="/faq" className="ds-link mt-4 inline-block text-[15px]">{t("moreFaq")} →</Link>
          </section>
        </div>
      </div>

      <div className="ds-wrap pb-14">
        <Link href="/book-a-call" className="ds-btn ds-btn-primary w-full md:w-auto">{ts("bookConsultation")}</Link>
      </div>
    </div>
  );
}
