import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guard";
import { ChevronRightIcon } from "@/components/icons";

/** Field home: assigned jobs only — never prices (brief §6). */
export default async function FieldJobsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, ["field"]);
  const t = await getTranslations("field");

  const { data: jobs } = await supabase
    .from("jobs")
    .select(
      "id, status, created_at, client_first_name, service_requests(id, type, title, details)"
    )
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="headline mb-4 text-2xl text-forest">{t("myJobs")}</h1>
      {!jobs?.length ? (
        <p className="card p-6 text-center text-sm text-muted">{t("noJobs")}</p>
      ) : (
        <ul className="space-y-3">
          {jobs.map((job) => {
            const req = job.service_requests as unknown as {
              id: string;
              type: string;
              title: string;
            } | null;
            const firstName = job.client_first_name;
            return (
              <li key={job.id}>
                <Link
                  href={`/field/jobs/${job.id}`}
                  className="card flex items-center justify-between gap-3 p-4 transition-shadow hover:shadow-(--shadow-card-hover)"
                >
                  <div className="min-w-0">
                    <p className="truncate font-bold text-forest">{req?.title}</p>
                    <p className="text-xs text-muted">
                      {t(`requestType.${req?.type}` as never)}
                      {firstName && ` · ${t("client")}: ${firstName}`}
                    </p>
                  </div>
                  <span className="flex items-center gap-2">
                    <span className="rounded-full bg-offwhite px-2.5 py-1 text-[11px] font-bold text-forest">
                      {t(`jobStatus.${job.status}` as never)}
                    </span>
                    <ChevronRightIcon width={18} height={18} className="text-muted" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
