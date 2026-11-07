import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guard";
import { CreateBuildForm } from "@/components/build/StageActions";
import { ChevronRightIcon } from "@/components/icons";

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
    <div className="space-y-5">
      <h1 className="headline text-2xl text-forest">{t("buildStages")}</h1>
      <ul className="space-y-2">
        {(builds ?? []).map((b) => {
          const own = (stages ?? []).filter((s) => s.request_id === b.id);
          const current = own.find((s) => s.status !== "approved" && s.status !== "locked");
          const done = own.filter((s) => s.status === "approved").length;
          return (
            <li key={b.id}>
              <Link href={`/admin/builds/${b.id}`} className="card flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-bold text-forest">{b.title}</p>
                  <p className="text-xs text-muted">
                    {(b.profiles as unknown as { full_name: string } | null)?.full_name} ·{" "}
                    {t("progress", { done, total: own.length })}
                    {current ? ` · ${current.name}: ${t(`status.${current.status}` as never)}` : ""}
                  </p>
                </div>
                <ChevronRightIcon width={18} height={18} className="shrink-0 text-muted" />
              </Link>
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
