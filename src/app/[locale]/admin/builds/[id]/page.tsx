import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guard";
import { loadBuild } from "@/lib/build";
import StageList from "@/components/build/StageList";
import { AddStageForm } from "@/components/build/StageActions";
import { AssignStaffForm } from "@/components/admin/AdminActions";

export default async function AdminBuildPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const { supabase, user } = await requireRole(locale, ["admin"]);
  const t = await getTranslations("build");

  const build = await loadBuild(supabase, id, { withPrices: true });
  if (!build) notFound();

  const [{ data: client }, { data: jobs }, { data: staff }] = await Promise.all([
    supabase.from("profiles").select("full_name, email, whatsapp").eq("id", build.client_id).single(),
    supabase.from("jobs").select("id, profiles:assigned_to(full_name)").eq("request_id", id),
    supabase.from("profiles").select("id, full_name, staff_kind").eq("role", "field").order("full_name"),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <Link href="/admin/builds" className="text-xs font-semibold text-muted hover:text-forest">
          ← {t("buildStages")}
        </Link>
        <h1 className="section-title mt-1 text-2xl">{build.title}</h1>
        <p className="text-xs text-muted">
          {client?.full_name} · {client?.email}
          {client?.whatsapp ? ` · ${client.whatsapp}` : ""} · {String(build.details.site_address ?? "")}
        </p>
        <p className="mt-1 text-xs">
          <Link href={`/admin/requests/${id}#payments`} className="font-semibold text-forest underline">
            {t("paymentsAndChat")}
          </Link>
        </p>
      </div>

      <section className="card p-4">
        <p className="text-sm font-bold text-forest">{t("fieldStaff")}</p>
        <p className="mt-1 text-xs text-muted">
          {(jobs ?? []).map((j) => (j.profiles as unknown as { full_name: string } | null)?.full_name).join(", ") || "—"}
        </p>
        <p className="mt-1 text-[11px] text-muted">{t("buyerRule")}</p>
        <div className="mt-2">
          <AssignStaffForm requestId={id} staff={staff ?? []} />
        </div>
      </section>

      <StageList build={build} role="admin" meId={user.id} />
      <AddStageForm requestId={id} />
    </div>
  );
}
