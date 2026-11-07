import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guard";
import { CreateBuildForm } from "@/components/build/StageActions";
import { toneFor } from "@/lib/tones";
import { StatusBadge } from "@/components/ui/Portal";
import { ArrowRightIcon, CheckIcon, HammerIcon, UserIcon } from "@/components/ui/PortalIcons";

export default async function AdminBuildsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, ["admin"]);
  const t = await getTranslations("build");

  const [{ data: builds }, { data: stages }, { data: clients }, { data: staff }] = await Promise.all([
    supabase
      .from("service_requests")
      .select("id, title, profiles:client_id(full_name)")
      .eq("type", "build")
      .order("created_at", { ascending: false }),
    supabase.from("build_stages").select("request_id, name, status, position").order("position"),
    supabase.from("profiles").select("id, full_name, email").eq("role", "client").order("full_name"),
    supabase.from("profiles").select("id, full_name").eq("role", "field").order("full_name"),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="section-title">{t("buildStages")}</h1>
      <ul className="space-y-3">
        {(builds ?? []).map((b) => {
          const own = (stages ?? []).filter((s) => s.request_id === b.id);
          const current = own.find((s) => s.status !== "approved" && s.status !== "locked");
          const done = own.filter((s) => s.status === "approved").length;
          return (
            <li key={b.id}>
              <article className="card relative p-4">
                <div className="flex items-start gap-3">
                  <span className="icon-round icon-forest h-12 w-12">
                    <HammerIcon size={24} />
                  </span>
                  <div className="min-w-0 flex-1">
                    {current && (
                      <StatusBadge tone={toneFor(current.status)}>
                        {current.name}: {t(`status.${current.status}` as never)}
                      </StatusBadge>
                    )}
                    <h2 className="mt-1.5 text-[15px] font-extrabold text-ink">
                      <Link href={`/admin/builds/${b.id}`} className="after:absolute after:inset-0">
                        {b.title}
                      </Link>
                    </h2>
                    <p className="mt-0.5 flex flex-wrap gap-x-3 text-[13px] text-muted">
                      <span className="flex items-center gap-1">
                        <UserIcon size={15} />
                        {(b.profiles as unknown as { full_name: string } | null)?.full_name}
                      </span>
                      <span>{t("progress", { done, total: own.length })}</span>
                    </p>
                  </div>
                </div>
                <ol className="mt-3 flex items-center gap-1" aria-label={t("progress", { done, total: own.length })}>
                  {own.map((st, i) => (
                    <li key={st.position} className="flex flex-1 items-center gap-1">
                      <span
                        title={st.name}
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                          st.status === "approved"
                            ? "bg-forest text-white"
                            : current?.position === st.position
                              ? "bg-forest text-white ring-2 ring-ok-soft"
                              : "bg-[#eef1ef] text-muted"
                        }`}
                      >
                        {st.status === "approved" ? <CheckIcon size={13} /> : i + 1}
                      </span>
                      {i < own.length - 1 && <span aria-hidden className={`h-[3px] flex-1 rounded ${st.status === "approved" ? "bg-forest" : "bg-[#dfe3e1]"}`} />}
                    </li>
                  ))}
                </ol>
                <span className="btn-details pointer-events-none relative mt-3">
                  {t("viewDetails")}
                  <ArrowRightIcon size={16} />
                </span>
              </article>
            </li>
          );
        })}
        {!builds?.length && <li className="rounded-xl bg-info p-4 text-sm text-ink">{t("noBuilds")}</li>}
      </ul>
      <CreateBuildForm
        clients={(clients ?? []).map((c) => ({ id: c.id, label: `${c.full_name || c.email} (${c.email})` }))}
        staff={(staff ?? []).map((s) => ({ id: s.id, label: s.full_name }))}
      />
    </div>
  );
}
