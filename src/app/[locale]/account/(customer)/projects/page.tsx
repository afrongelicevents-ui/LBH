import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guard";
import { REQUEST_TIMELINE, timelineIndex, type RequestStatus } from "@/lib/status";
import PageHead from "@/components/account/PageHead";

const clean = (s: string | null | undefined) => (s ?? "").replace(/^SAMPLE\s*[—-]?\s*/, "");

/** My projects — every request the customer has with LBH. */
export default async function ProjectsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, ["client"]);
  const t = await getTranslations("account.dashboard");
  const ta = await getTranslations("account.pages");
  const tn = await getTranslations("site.account");
  const ts = await getTranslations("portal.status");
  const { data } = await supabase.from("service_requests").select("id, type, status, title, details, updated_at").order("updated_at", { ascending: false });
  const all = data ?? [];
  const fmt = (d: string) => new Date(d).toLocaleDateString(locale === "en" ? "en-GB" : locale, { day: "numeric", month: "short", year: "numeric" });
  return (
    <div data-testid="projects-page">
      <PageHead eyebrow={tn("projects")} title={ta("projectsTitle")} intro={ta("projectsIntro")}>
        <Link href="/account/projects/new-land" className="ds-btn ds-btn-primary min-h-11 px-4 text-sm">{t("newLand")}</Link>
        <Link href="/account/projects/new-materials" className="ds-btn ds-btn-outline min-h-11 px-4 text-sm">{t("newMaterials")}</Link>
      </PageHead>
      {all.length === 0 ? (
        <p className="ds-body mt-8">{t("noProjects")}</p>
      ) : (
        <ul className="mt-2" data-testid="project-list">
          {all.map((r) => {
            const i = timelineIndex(r.status as RequestStatus);
            const pct = r.status === "cancelled" ? 0 : Math.round(((i + 1) / REQUEST_TIMELINE.length) * 100);
            const d = (r.details ?? {}) as { town?: string; stand_number?: string };
            const where = [d.stand_number && `Stand ${d.stand_number}`, d.town].filter(Boolean).join(", ");
            return (
              <li key={r.id} className="border-b border-rule">
                <Link href={r.type === "build" ? `/account/progress/${r.id}` : `/account/projects/${r.id}`} className="group grid gap-3 py-6 md:grid-cols-12 md:items-center">
                  <div className="md:col-span-6">
                    <p className="text-xs font-semibold tracking-wider text-slate uppercase">{t(`type.${r.type}` as never)}</p>
                    <p className="mt-1 font-serif text-[1.25rem] text-charcoal group-hover:text-forest">{clean(r.title)}</p>
                    {where && <p className="text-sm text-slate">{clean(where)}</p>}
                  </div>
                  <div className="md:col-span-5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-charcoal">{ts(r.status as never)}</span>
                      <span className="text-slate">{ta("updatedOn", { date: fmt(r.updated_at) })}</span>
                    </div>
                    <div className="mt-2 h-1 bg-sand"><div className="h-1 bg-forest" style={{ width: `${pct}%` }} /></div>
                  </div>
                  <span aria-hidden className="hidden text-right text-forest md:col-span-1 md:block">→</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
