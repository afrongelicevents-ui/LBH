import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guard";
import { signedUrl } from "@/lib/uploads";
import { formatCents } from "@/lib/money";
import {
  VisitForm,
  MediaUploadForm,
  ExtraCostForm,
  ReportDraftForm,
} from "@/components/field/JobForms";

/** Field job detail — stand details + documents, NO prices (brief §6). */
export default async function FieldJobPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const { supabase, user } = await requireRole(locale, ["field"]);
  const t = await getTranslations("field");

  const { data: job } = await supabase
    .from("jobs")
    .select(
      "id, status, checklist, visit, request_id, service_requests(id, type, title, details, profiles:client_id(full_name))"
    )
    .eq("id", id)
    .maybeSingle();
  if (!job) notFound();

  const req = job.service_requests as unknown as {
    id: string;
    type: string;
    title: string;
    details: Record<string, unknown>;
    profiles: { full_name: string } | null;
  };

  const [{ data: documents }, { data: media }, { data: extraCosts }, { data: report }] =
    await Promise.all([
      supabase.from("documents").select("*").eq("request_id", job.request_id),
      supabase
        .from("media")
        .select("*")
        .eq("job_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("extra_cost_requests")
        .select("*")
        .eq("job_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("reports")
        .select("id, status, verdict, sections")
        .eq("job_id", id)
        .eq("author_id", user.id)
        .maybeSingle(),
    ]);

  const docLinks = await Promise.all(
    (documents ?? []).map(async (d) => ({
      ...d,
      url: await signedUrl("documents", d.storage_path),
    }))
  );

  const details = (req.details ?? {}) as Record<string, unknown>;
  const firstName = req.profiles?.full_name?.split(" ")[0] ?? "";

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <Link href="/field" className="text-xs font-semibold text-muted hover:text-forest">
          ← {t("myJobs")}
        </Link>
        <h1 className="headline mt-1 text-2xl text-forest">{req.title}</h1>
        <p className="text-xs text-muted">
          {t(`requestType.${req.type}` as never)}
          {firstName && ` · ${t("client")}: ${firstName}`} ·{" "}
          {t(`jobStatus.${job.status}` as never)}
        </p>
      </div>

      <section className="card p-5">
        <h2 className="text-base font-bold text-forest">{t("standDetails")}</h2>
        <dl className="mt-2 space-y-1 text-sm text-ink">
          {Object.entries(details).map(([k, v]) =>
            v === null || v === "" || typeof v === "object" ? null : (
              <div key={k} className="flex gap-2">
                <dt className="font-semibold text-muted">{k.replaceAll("_", " ")}:</dt>
                <dd>{String(v)}</dd>
              </div>
            )
          )}
        </dl>
        {docLinks.length > 0 && (
          <>
            <h3 className="mt-3 text-sm font-bold text-forest">{t("clientDocuments")}</h3>
            <ul className="mt-1 space-y-1 text-sm">
              {docLinks.map((d) =>
                d.url ? (
                  <li key={d.id}>
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-forest underline underline-offset-2"
                    >
                      {d.file_name}
                    </a>
                  </li>
                ) : null
              )}
            </ul>
          </>
        )}
      </section>

      <section className="card p-5">
        <h2 className="text-base font-bold text-forest">{t("visitTitle")}</h2>
        <div className="mt-3">
          <VisitForm jobId={job.id} visit={(job.visit ?? {}) as Record<string, unknown>} />
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-base font-bold text-forest">{t("captureTitle")}</h2>
        <p className="mt-1 text-xs text-muted">{t("captureHint")}</p>
        <div className="mt-3 grid gap-5 sm:grid-cols-3">
          <div>
            <h3 className="mb-2 text-xs font-bold text-muted uppercase">{t("photos")}</h3>
            <MediaUploadForm jobId={job.id} kind="photo" />
          </div>
          <div>
            <h3 className="mb-2 text-xs font-bold text-muted uppercase">{t("videos")}</h3>
            <MediaUploadForm jobId={job.id} kind="video" />
          </div>
          <div>
            <h3 className="mb-2 text-xs font-bold text-muted uppercase">{t("receipts")}</h3>
            <MediaUploadForm jobId={job.id} kind="receipt" />
          </div>
        </div>

        {(media ?? []).length > 0 && (
          <ul className="mt-4 space-y-1.5 border-t border-line pt-3 text-xs text-muted">
            {(media ?? []).map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-forest uppercase">{m.kind}</span>
                <span>{m.original_name || m.note}</span>
                {m.taken_at && <span>· {new Date(m.taken_at).toLocaleString()}</span>}
                {typeof m.amount_cents === "number" && (
                  <span>· {formatCents(m.amount_cents)}</span>
                )}
                {m.flagged_far && (
                  <span className="font-bold text-red-700">
                    ⚠ {t("farFlag", { m: String(m.distance_from_pin_m ?? "?") })}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-5">
        <h2 className="text-base font-bold text-forest">{t("extraCostTitle")}</h2>
        <p className="mt-1 text-xs text-muted">{t("extraCostHint")}</p>
        <div className="mt-3">
          <ExtraCostForm jobId={job.id} />
        </div>
        {(extraCosts ?? []).length > 0 && (
          <ul className="mt-3 space-y-1 border-t border-line pt-3 text-xs">
            {(extraCosts ?? []).map((ec) => (
              <li key={ec.id} className="flex justify-between gap-2">
                <span className="text-ink">
                  {ec.title} · {formatCents(ec.amount_cents)}
                </span>
                <span className="font-bold text-muted">
                  {t(`extraStatus.${ec.status}` as never)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-5">
        <h2 className="text-base font-bold text-forest">{t("reportTitle")}</h2>
        <p className="mt-1 text-xs text-muted">{t("reportHint")}</p>
        <div className="mt-3">
          <ReportDraftForm
            jobId={job.id}
            report={
              report
                ? {
                    verdict: report.verdict,
                    sections: (report.sections ?? {}) as Record<string, string>,
                    status: report.status,
                  }
                : null
            }
          />
        </div>
      </section>
    </div>
  );
}
