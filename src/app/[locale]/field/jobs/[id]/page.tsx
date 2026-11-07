import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guard";
import { signedUrl } from "@/lib/uploads";
import { formatCents } from "@/lib/money";
import { loadBuild } from "@/lib/build";
import StageList from "@/components/build/StageList";
import {
  VisitForm,
  LegalChecklistForm,
  MediaUploadForm,
  ExtraCostForm,
  ReportDraftForm,
} from "@/components/field/JobForms";
import { readLegal } from "@/lib/legal";
import { toneFor } from "@/lib/tones";
import { StatusBadge } from "@/components/ui/Portal";
import { CalendarIcon } from "@/components/ui/PortalIcons";

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
  const th = await getTranslations("field.home");
  const tl = await getTranslations("labels");

  const { data: job } = await supabase
    .from("jobs")
    .select(
      "id, job_type, status, due_date, checklist, visit, request_id, client_first_name, service_requests(id, type, title, details)"
    )
    .eq("id", id)
    .maybeSingle();
  if (!job) notFound();
  const statusLine = (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <StatusBadge tone={toneFor(job.status)}>{t(`jobStatus.${job.status}` as never)}</StatusBadge>
      {job.due_date && (
        <span className="badge badge-grey" data-testid="job-due">
          <CalendarIcon size={14} />
          {th("due", {
            date: new Intl.DateTimeFormat(locale === "en" ? "en-GB" : locale, { day: "numeric", month: "short", year: "numeric" }).format(
              new Date(`${job.due_date}T12:00:00`)
            ),
          })}
        </span>
      )}
    </div>
  );

  const req = job.service_requests as unknown as {
    id: string;
    type: string;
    title: string;
    details: Record<string, unknown>;
  };

  // Construction build: stage-by-stage work (never any prices for field staff)
  if (req.type === "build") {
    const build = await loadBuild(supabase, req.id, { withPrices: false });
    if (!build) notFound();
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div>
          <Link href="/field" className="text-xs font-semibold text-muted hover:text-forest">
            ← {t("myJobs")}
          </Link>
          <h1 className="section-title mt-1 text-2xl">{build.title}</h1>
          <p className="text-xs text-muted">
            {String(build.details.site_address ?? "")}
            {job.client_first_name ? ` · ${t("client")}: ${job.client_first_name}` : ""}
          </p>
          {statusLine}
        </div>
        <StageList build={build} role="field" meId={user.id} />
      </div>
    );
  }

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
  const firstName = job.client_first_name;
  const isTitleCheck = job.job_type === "title_check";
  const jobLabel = req.title.replace(/^SAMPLE — /, "");

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <Link href="/field" className="text-xs font-semibold text-muted hover:text-forest">
          ← {t("myJobs")}
        </Link>
        <h1 className="section-title mt-1 text-2xl">{req.title}</h1>
        <p className="text-xs text-muted">
          {isTitleCheck ? t("jobType.title_check") : t(`requestType.${req.type}` as never)}
          {firstName && ` · ${t("client")}: ${firstName}`}
        </p>
        {statusLine}
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

      {isTitleCheck ? (
        <section className="card p-5">
          <h2 className="text-base font-bold text-forest">{t("legal.title")}</h2>
          <p className="mt-1 text-xs text-muted">{t("legal.hint")}</p>
          <div className="mt-3">
            <LegalChecklistForm jobId={job.id} jobLabel={jobLabel} legal={readLegal(job.visit)} />
          </div>
        </section>
      ) : (
        <section className="card p-5">
          <h2 className="text-base font-bold text-forest">{t("visitTitle")}</h2>
          <div className="mt-3">
            <VisitForm
              jobId={job.id}
              jobLabel={jobLabel}
              visit={(job.visit ?? {}) as Record<string, unknown>}
            />
          </div>
        </section>
      )}

      <section className="card p-5">
        <h2 className="text-base font-bold text-forest">{t("captureTitle")}</h2>
        <p className="mt-1 text-xs text-muted">{t("captureHint")}</p>
        <div className="mt-3 grid gap-5 sm:grid-cols-3">
          <div>
            <h3 className="mb-2 text-xs font-bold text-muted uppercase">{t("photos")}</h3>
            <MediaUploadForm jobId={job.id} jobLabel={jobLabel} kind="photo" />
          </div>
          <div>
            <h3 className="mb-2 text-xs font-bold text-muted uppercase">{t("videos")}</h3>
            <MediaUploadForm jobId={job.id} jobLabel={jobLabel} kind="video" />
          </div>
          <div>
            <h3 className="mb-2 text-xs font-bold text-muted uppercase">{t("receipts")}</h3>
            <MediaUploadForm jobId={job.id} jobLabel={jobLabel} kind="receipt" />
          </div>
        </div>

        {(media ?? []).length > 0 && (
          <ul className="mt-4 space-y-1.5 border-t border-line pt-3 text-xs text-muted">
            {(media ?? []).map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-forest uppercase">{tl(`media.${m.kind}` as never)}</span>
                <span>{m.original_name || m.note}</span>
                {m.taken_at && (
                  <span>
                    · {t("capturedAt", { at: new Date(m.taken_at).toLocaleString() })}
                  </span>
                )}
                {m.capture_source === "camera" && <span>· {t("inAppCamera")}</span>}
                {m.gps_lat !== null && m.gps_lng !== null ? (
                  <span>
                    · GPS {Number(m.gps_lat).toFixed(5)}, {Number(m.gps_lng).toFixed(5)}
                    {m.gps_accuracy_m !== null && ` ±${Math.round(Number(m.gps_accuracy_m))} m`}
                  </span>
                ) : (
                  <span>· {t("camera.noGps")}</span>
                )}
                {m.taken_at &&
                  new Date(m.uploaded_at).getTime() - new Date(m.taken_at).getTime() > 10 * 60 * 1000 && (
                    <span>
                      · {t("uploadedLater", { at: new Date(m.uploaded_at).toLocaleString() })}
                    </span>
                  )}
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
            jobLabel={jobLabel}
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
