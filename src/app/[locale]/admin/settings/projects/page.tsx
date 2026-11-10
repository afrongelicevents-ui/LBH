import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guard";
import { sitePhotoUrl } from "@/config/sitePhotos";
import { ProjectForm, ProjectPhotoUpload, ProjectButtons, DeletePhotoButton, MenuToggle } from "@/components/admin/ProjectsAdmin";

/** Admin → Settings → Projects: genuine LBH project photos for the public Projects page. */
export default async function AdminProjectsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, ["admin"]);
  const t = await getTranslations("admin.projects");
  const [{ data: projects }, { data: photos }, { data: settings }] = await Promise.all([
    supabase.from("projects").select("id, title, location, stage, summary, published, updated_at").order("sort").order("created_at", { ascending: false }),
    supabase.from("project_photos").select("id, project_id, storage_path, caption, taken_on").order("sort").order("created_at"),
    supabase.from("settings").select("projects_in_nav").eq("id", 1).single(),
  ]);
  const published = (projects ?? []).filter((p) => p.published).length;
  return (
    <div className="mx-auto max-w-4xl space-y-5" data-testid="admin-projects">
      <div>
        <Link href="/admin/settings" className="text-xs font-semibold text-muted hover:text-forest">← {t("back")}</Link>
        <h1 className="section-title mt-1 text-2xl">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("intro")}</p>
      </div>
      <section className="card space-y-3 p-5">
        <h2 className="font-extrabold">{t("menuTitle")}</h2>
        <MenuToggle on={settings?.projects_in_nav ?? false} publishedCount={published} />
        <Link href="/projects" className="text-sm font-bold text-forest underline">{t("viewPage")}</Link>
      </section>
      <section className="card p-5">
        <h2 className="mb-3 font-extrabold">{t("newTitle")}</h2>
        <ProjectForm />
      </section>
      {(projects ?? []).map((p) => {
        const ps = (photos ?? []).filter((x) => x.project_id === p.id);
        return (
          <section key={p.id} className="card space-y-4 p-5" data-testid="admin-project">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-extrabold">
                {p.title} <span className={`ml-2 text-xs ${p.published ? "text-forest" : "text-muted"}`}>{p.published ? t("isPublished") : t("isDraft")}</span>
              </h2>
              <ProjectButtons id={p.id} published={p.published} hasPhotos={ps.length > 0} />
            </div>
            {ps.length > 0 ? (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {ps.map((ph) => (
                  <li key={ph.id} className="space-y-1">
                    <span className="relative block aspect-[4/3] overflow-hidden rounded bg-info">
                      <Image src={sitePhotoUrl(ph.storage_path)} alt={ph.caption || p.title} fill sizes="200px" className="object-cover" />
                    </span>
                    <span className="block truncate text-xs text-muted">{ph.caption}{ph.taken_on ? ` · ${ph.taken_on}` : ""}</span>
                    <DeletePhotoButton id={ph.id} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">{t("noPhotos")}</p>
            )}
            <ProjectPhotoUpload projectId={p.id} />
            <details>
              <summary className="cursor-pointer text-sm font-bold text-forest">{t("edit")}</summary>
              <div className="mt-3"><ProjectForm project={p} /></div>
            </details>
          </section>
        );
      })}
    </div>
  );
}
