import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PHOTO_CREDITS, HAVE_LICENSED_FILES } from "@/config/stockPhotos";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "aboutPage" });
  return { title: t("metaTitle"), description: t("intro") };
}

/** About LBH — who we are, why we exist, how we work. */
export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("aboutPage");
  const ts = await getTranslations("site");
  return (
    <div data-testid="about-page">
      <header className="border-b border-rule">
        <div className="ds-wrap py-14 md:py-20">
          <p className="ds-eyebrow">{t("title")}</p>
          <h1 className="ds-h2 mt-3 max-w-3xl md:text-[3.2rem]">{ts("about.title")}</h1>
          <p className="ds-lead mt-5 max-w-2xl">{t("intro")}</p>
        </div>
      </header>

      <div className="ds-wrap grid gap-12 py-14 md:grid-cols-12 md:py-20">
        <section className="md:col-span-5" aria-labelledby="who">
          <h2 id="who" className="ds-h3 text-[1.6rem]">{t("whoTitle")}</h2>
          <p className="ds-body mt-3 text-base">{t("whoText")}</p>
        </section>
        <section className="md:col-span-6 md:col-start-7" aria-labelledby="why">
          <h2 id="why" className="ds-h3 text-[1.6rem]">{t("whyTitle")}</h2>
          <p className="ds-body mt-3 text-base">{t("whyText")}</p>
        </section>
      </div>

      <section aria-labelledby="values" className="border-y border-rule bg-paper py-14 md:py-20">
        <div className="ds-wrap grid gap-8 md:grid-cols-12">
          <h2 id="values" className="ds-h2 md:col-span-4">{t("valuesTitle")}</h2>
          <ol className="md:col-span-7 md:col-start-6">
            {(["value1", "value2", "value3", "value4"] as const).map((k, i) => (
              <li key={k} className="flex gap-5 border-b border-rule py-5 first:border-t">
                <span className="font-serif text-2xl text-stone">{i + 1}</span>
                <span className="font-serif text-[1.25rem] leading-snug text-charcoal">{t(k)}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <div className="ds-wrap grid gap-12 py-14 md:grid-cols-12 md:py-20">
        <section className="md:col-span-6" aria-labelledby="team">
          <h2 id="team" className="ds-h3 text-[1.6rem]">{t("teamTitle")}</h2>
          <p className="ds-body mt-3 text-base">{t("teamText")}</p>
          <Link href="/book-a-call" className="ds-btn ds-btn-primary mt-7">{ts("bookConsultation")}</Link>
        </section>
        {HAVE_LICENSED_FILES && <section className="md:col-span-5 md:col-start-8" aria-labelledby="credits" id="photo-credits">
          <h2 id="credits" className="text-sm font-semibold tracking-wider text-charcoal uppercase">{ts("about.creditsTitle")}</h2>
          <p className="ds-body mt-2 text-sm">{ts("about.creditsText")}</p>
          <ul className="mt-3 space-y-1.5 text-sm text-slate">
            {PHOTO_CREDITS.map((c) => (
              <li key={c.url}>
                <a href={c.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-forest">{c.title}</a>
                {" "}— {c.author}, {c.licence}
              </li>
            ))}
          </ul>
        </section>}
      </div>
    </div>
  );
}
