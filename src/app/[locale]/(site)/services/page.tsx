import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import NotifyMeForm from "@/components/NotifyMeForm";
import { ServiceTiles } from "@/components/site/home/HomeSections";
import { INTERIORS_PATH, SERVICE_GROUP_KEYS, servicePath, servicesIn } from "@/config/services";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "site.servicesPage" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

/** Services: three big tiles (Land · Build · Finish), every service listed, and the camera notify. */
export default async function ServicesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("site.servicesPage");
  const tw = await getTranslations("site.ws");
  const tg = await getTranslations("site.groups");
  const ts = await getTranslations("site");

  return (
    <div data-testid="services-page">
      <div className="ds-wrap pt-6 pb-2 md:pt-12">
        <h1 className="font-serif text-[2.25rem] leading-[0.95] font-extrabold tracking-[-0.035em] md:text-[3.5rem]">{tw("servicesTitle")}</h1>
        <p className="ws-lede mt-3 max-w-2xl">{tw("servicesIntro")}</p>
        <ServiceTiles short tall />
      </div>

      {/* every service, by group (each has its own page) */}
      <div className="ds-wrap grid gap-8 pt-12 pb-4 md:grid-cols-3 md:pt-16">
        {SERVICE_GROUP_KEYS.map((g) => (
          <section key={g} id={`${g}-group`} aria-labelledby={`${g}-group-title`} className="scroll-mt-24" data-testid={`group-${g}`}>
            <h2 id={`${g}-group-title`} className="text-[1.5rem] font-extrabold">{tg(`${g}.title`)}</h2>
            <p className="ws-lede mt-1 text-[15px]">{tg(`${g}.text`)}</p>
            <ul className="mt-3 border-t border-rule">
              {(g === "finish" ? [{ key: "interiors", href: INTERIORS_PATH, label: tg("items.interiors") }] : servicesIn(g).map((s) => ({ key: s.key, href: servicePath(s.key), label: t(`${s.key}.title`) }))).map((s) => (
                <li key={s.key} id={s.key} className="scroll-mt-24">
                  <Link href={s.href} className="flex min-h-[52px] items-center justify-between gap-3 border-b border-rule font-semibold hover:text-forest" data-testid={s.key === "interiors" ? "interiors-link" : undefined}>
                    {s.label}
                    <span aria-hidden className="text-slate">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <section id="camera" aria-labelledby="soon" className="ds-wrap scroll-mt-24 py-10 md:py-14">
        <div className="grid gap-6 rounded-[28px] bg-paper p-6 md:grid-cols-12 md:items-end md:p-10">
          <div className="md:col-span-7">
            <span className="ds-tag">{ts("home.services.soonTag")}</span>
            <h2 id="soon" className="ds-h3 mt-3">{t("camera.title")}</h2>
            <p className="ds-body mt-2">{t("camera.text")}</p>
            <Link href="/sample/live" className="ds-link mt-3 inline-block text-[15px]">{ts("sampleLive")} →</Link>
          </div>
          <div className="md:col-span-5">
            <NotifyMeForm service="camera" />
          </div>
        </div>
      </section>
    </div>
  );
}
