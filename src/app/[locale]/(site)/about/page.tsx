import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PHOTO_CREDITS, HAVE_LICENSED_FILES } from "@/config/stockPhotos";
import { PHOTOS, PHOTO_CREDITS_NOTE } from "@/config/photos";
import DetailHero from "@/components/ws/DetailHero";
import { site, waLink } from "@/config/site";

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
  const tw = await getTranslations("site.ws");
  return (
    <div data-testid="about-page">
      <DetailHero photo={PHOTOS.about} kicker={tw("aboutKicker")} title={tw("aboutTitle")} stockLabel={ts("stockPhoto")} tall={false} />
      <div className="ds-wrap pt-6 md:pt-12">
        <p className="ws-dlead max-w-3xl">{tw("aboutLead")}</p>
      </div>

      <div className="ds-wrap grid gap-12 py-10 md:grid-cols-12 md:gap-14 md:py-14">
        <section className="md:col-span-7" aria-labelledby="rules">
          <h2 id="rules" className="text-[1.5rem] font-extrabold">{tw("rulesTitle")}</h2>
          <ul className="ws-incl mt-3">
            {[1, 2, 3].map((n) => (
              <li key={n}>
                <div className="ic">{n}</div>
                <div>
                  <b>{tw(`rules.r${n}t`)}</b>
                  <span className="d">{tw(`rules.r${n}`)}</span>
                </div>
              </li>
            ))}
          </ul>

          <h2 id="who" className="mt-10 text-[1.5rem] font-extrabold">{t("whoTitle")}</h2>
          <p className="ds-body mt-2 text-base">{t("whoText")}</p>
          <h2 id="team" className="mt-8 text-[1.5rem] font-extrabold">{t("teamTitle")}</h2>
          <p className="ds-body mt-2 text-base">{t("teamText")}</p>
        </section>

        <aside className="space-y-10 md:col-span-5">
          <section aria-labelledby="talk">
            <h2 id="talk" className="text-[1.5rem] font-extrabold">{tw("talkTitle")}</h2>
            <dl className="mt-3 border-t border-rule">
              {waLink() && (
                <div className="border-b border-rule py-3.5">
                  <dt className="font-bold">WhatsApp</dt>
                  <dd><a href={waLink()!} target="_blank" rel="noopener noreferrer" className="ds-link text-sm">+{site.whatsappNumber}</a></dd>
                </div>
              )}
              <div className="border-b border-rule py-3.5">
                <dt className="font-bold">Email</dt>
                <dd><a href={`mailto:${site.email}`} className="ds-link text-sm">{site.email}</a></dd>
              </div>
              <div className="border-b border-rule py-3.5">
                <dt className="font-bold">{tw("talkChat")}</dt>
                <dd className="text-sm text-slate">{tw("talkChatText")}</dd>
              </div>
            </dl>
            <Link href="/book-a-call" className="ds-btn ds-btn-primary mt-6 w-full">{ts("bookConsultation")}</Link>
          </section>

          {HAVE_LICENSED_FILES && (
            <section aria-labelledby="credits" id="photo-credits" className="rounded-[24px] bg-paper p-6">
              <h2 id="credits" className="ws-kicker">{ts("about.creditsTitle")}</h2>
              <p className="ds-body mt-2 text-sm">{PHOTO_CREDITS_NOTE}</p>
              <ul className="mt-3 space-y-1.5 text-sm text-slate">
                {PHOTO_CREDITS.map((c) => (
                  <li key={c.url}>
                    <a href={c.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-forest">{c.title}</a>
                    {" "}— {c.author}, {c.licence}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
