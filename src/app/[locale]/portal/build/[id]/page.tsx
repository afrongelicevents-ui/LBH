import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole } from "@/lib/auth/guard";
import { loadBuild } from "@/lib/build";
import StageList from "@/components/build/StageList";

export default async function ClientBuildPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const { supabase, user } = await requireRole(locale, ["client"]);
  const t = await getTranslations("build");

  const build = await loadBuild(supabase, id, { withPrices: true });
  if (!build) notFound();

  const done = build.stages.filter((s) => s.status === "approved").length;
  const current = build.stages.find((s) => s.status !== "approved" && s.status !== "locked");

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="section-title text-2xl">{build.title}</h1>
        <p className="text-xs text-muted">{String(build.details.site_address ?? "")}</p>
      </div>
      <div className="rounded-2xl bg-ok-soft/60 p-3 text-sm text-ink">
        <p className="font-bold">
          {t("progress", { done, total: build.stages.length })}
          {current ? ` · ${t("currentStage", { stage: current.name })}` : ""}
        </p>
        <p className="mt-1 text-xs">{t("howItWorksShort")}</p>
      </div>
      <StageList build={build} role="client" meId={user.id} />
    </div>
  );
}
