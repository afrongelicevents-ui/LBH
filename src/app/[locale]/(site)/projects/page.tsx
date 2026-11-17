import Image from "next/image";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { sitePhotoUrl } from "@/config/sitePhotos";
import { loadPublishedProjects, showProjectsInNav } from "@/lib/projects";
import { Link as NavLink } from "@/i18n/navigation";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "site.projectsPage" });
  return { title: t("metaTitle"), description: t("intro") };
}

/** LBH projects — genuine LBH photos only. Until the admin publishes real content, the page says they are coming. */
export default async function ProjectsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const projects = (await showProjectsInNav()) ? await loadPublishedProjects() : [];
  const t = await getTranslations("site.projectsPage");
  const ts = await getTranslations("site");
  return (
    <div data-testid="projects-public">
      <header className="border-b border-rule">
        <div className="ds-wrap py-14 md:py-20">
          <p className="ds-eyebrow">{ts("nav.projects")}</p>
          <h1 className="ds-h2 mt-3 max-w-3xl md:text-[3.2rem]">{t("title")}</h1>
          <p className="ds-lead mt-5 max-w-2xl">{t("intro")}</p>
        </div>
      </header>
      {projects.length === 0 && (
        <section className="ds-wrap py-12 md:py-16" data-testid="projects-empty">
          <p className="ds-lead max-w-2xl">{t("empty")}</p>
          <NavLink href="/services" className="ds-link mt-5 inline-block">{ts("nav.services")} →</NavLink>
        </section>
      )}
      {projects.map((p, i) => {
        const photos = [...(p.project_photos ?? [])].sort((a, b) => a.sort - b.sort);
        return (
          <section key={p.id} className={`border-b border-rule py-14 md:py-20 ${i % 2 ? "bg-paper" : ""}`} aria-labelledby={`p-${p.id}`}>
            <div className="ds-wrap grid gap-8 md:grid-cols-12">
              <div className="md:col-span-4">
                {p.stage && <span className="ds-tag ds-tag-green">{p.stage}</span>}
                <h2 id={`p-${p.id}`} className="ds-h3 mt-3 text-[1.7rem]">{p.title}</h2>
                {p.location && <p className="text-sm text-slate">{p.location}</p>}
                {p.summary && <p className="ds-body mt-4 text-base">{p.summary}</p>}
              </div>
              <ul className="grid grid-cols-2 gap-3 md:col-span-8 md:grid-cols-3">
                {photos.map((ph, k) => (
                  <li key={ph.id} className={k === 0 ? "col-span-2 md:col-span-2 md:row-span-2" : ""}>
                    <figure>
                      <span className="relative block aspect-[4/3] overflow-hidden bg-sand">
                        <Image src={sitePhotoUrl(ph.storage_path)} alt={ph.caption || p.title} fill sizes="(min-width: 768px) 40vw, 50vw" className="object-cover" />
                      </span>
                      {(ph.caption || ph.taken_on) && (
                        <figcaption className="mt-1.5 text-xs text-slate">{[ph.caption, ph.taken_on].filter(Boolean).join(" · ")}</figcaption>
                      )}
                    </figure>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        );
      })}
      <div className="ds-wrap py-12">
        <Link href="/book-a-call" className="ds-btn ds-btn-primary">{ts("bookConsultation")}</Link>
      </div>
    </div>
  );
}
