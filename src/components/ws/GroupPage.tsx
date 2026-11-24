import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import Photo from "@/components/site/Photo";
import DetailHero from "./DetailHero";
import { PHOTOS } from "@/config/photos";
import { servicePath, servicesIn } from "@/config/services";

const ICONS = {
  doc: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /></svg>,
  pin: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>,
  check: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="m5 12 5 5L20 7" /></svg>,
  box: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden><path d="M4 7h16v12H4z" /><path d="M4 7l3-4h10l3 4" /></svg>,
  shield: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></svg>,
  camera: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden><path d="M3 8h4l2-3h6l2 3h4v11H3z" /><circle cx="12" cy="13" r="3.5" /></svg>,
};
export const INCL_ICONS = ICONS;

/** Land / Build group page (Warm Sand detail screen). */
export default async function GroupPage({ group }: { group: "land" | "build" }) {
  const t = await getTranslations(`site.ws.${group}`);
  const tw = await getTranslations("site.ws");
  const tp = await getTranslations("site.servicesPage");
  const ts = await getTranslations("site");
  const icons = group === "land" ? [ICONS.doc, ICONS.pin, ICONS.check] : [ICONS.box, ICONS.shield, ICONS.camera];
  const service = group === "land" ? "land" : "materials";
  return (
    <article data-testid={`group-page-${group}`}>
      <DetailHero photo={group === "land" ? PHOTOS.land : PHOTOS.build} kicker={t("kicker")} title={t("title")} backHref="/services" backLabel={tw("back")} stockLabel={ts("stockPhoto")} />
      <div className="ds-wrap grid gap-10 pt-6 pb-10 md:grid-cols-12 md:gap-14 md:pt-12 md:pb-16">
        <div className="md:col-span-7">
          <p className="ws-dlead">{t("lead")}</p>
          <ul className="ws-incl mt-6">
            {[1, 2, 3].map((n, i) => (
              <li key={n}>
                <div className="ic">{icons[i]}</div>
                <div>
                  <b>{t(`i${n}t`)}</b>
                  <span className="d">{t(`i${n}`)}</span>
                </div>
              </li>
            ))}
          </ul>
          {group === "build" && (
            <div className="relative mt-6 aspect-[16/10] overflow-hidden rounded-[24px]">
              <Photo photo={PHOTOS.buildPhoto} sizes="(min-width: 768px) 55vw, 100vw" className="absolute inset-0" stockLabel={ts("stockPhoto")} />
            </div>
          )}
          <Link href={`/book-a-call?service=${service}`} className="ds-btn ds-btn-primary mt-7 w-full md:w-auto" data-testid="group-book">
            {t("cta")}
          </Link>
        </div>
        <aside className="md:col-span-5">
          <h2 className="ws-kicker">{tw("inThisGroup")}</h2>
          <ul className="mt-3 space-y-3">
            {servicesIn(group).map((s) => (
              <li key={s.key}>
                <Link href={servicePath(s.key)} className="block rounded-[20px] border border-rule bg-paper p-5 hover:border-line">
                  <span className="flex items-center justify-between gap-3">
                    <b className="font-serif text-[1.2rem] font-bold">{tp(`${s.key}.title`)}</b>
                    <span aria-hidden className="text-forest">→</span>
                  </span>
                  <span className="mt-1 block text-sm text-slate">{ts(`home.services.${s.key}.text`)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </article>
  );
}
