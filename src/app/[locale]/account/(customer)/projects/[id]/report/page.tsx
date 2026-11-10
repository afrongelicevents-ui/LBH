import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guard";
import { signedUrl } from "@/lib/uploads";
import { formatCents } from "@/lib/money";

const SECTION_KEYS = [
  "stand_details",
  "legal_findings",
  "council_confirmation",
  "measurements",
  "red_flags",
  "next_steps",
  "costs_summary",
] as const;

const VERDICT_STYLES: Record<string, string> = {
  clear: "bg-forest text-white",
  concerns: "bg-info text-ink border-2 border-accent",
  red_flags: "bg-red-700 text-white",
};

/** Published land verification report (brief §7). */
export default async function ReportPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, ["client"]);
  const t = await getTranslations("portal.report");

  const { data: report } = await supabase
    .from("reports")
    .select("*")
    .eq("request_id", id)
    .eq("status", "published")
    .maybeSingle();
  if (!report) notFound();

  const { data: req } = await supabase
    .from("service_requests")
    .select("id, title")
    .eq("id", id)
    .single();

  const { data: media } = await supabase
    .from("media")
    .select("*")
    .eq("request_id", id)
    .in("kind", ["photo", "video", "receipt"])
    .order("taken_at", { ascending: true });

  const gallery = await Promise.all(
    (media ?? []).map(async (m) => ({
      ...m,
      url: await signedUrl("media", m.storage_path, 600),
    }))
  );

  const sections = (report.sections ?? {}) as Record<string, string>;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link
          href={`/account/projects/${id}`}
          className="text-xs font-semibold text-muted hover:text-forest"
        >
          ← {t("back")}
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="section-title text-2xl">
            {t("title")} — {req?.title}
          </h1>
          <a
            href={`/api/pdf/report/${report.id}`}
            className="btn btn-outline-green min-h-10 text-sm"
          >
            {t("downloadPdf")}
          </a>
        </div>
      </div>

      {/* Verdict at the top, in plain words (brief §7.1) */}
      <div
        className={`rounded-2xl p-5 ${VERDICT_STYLES[report.verdict ?? "concerns"]}`}
      >
        <p className="text-xs font-bold uppercase opacity-80">{t("verdictLabel")}</p>
        <p className="headline mt-1 text-2xl">
          {t(`verdict.${report.verdict}` as never)}
        </p>
        <p className="mt-1 text-sm opacity-90">
          {t(`verdictText.${report.verdict}` as never)}
        </p>
      </div>

      {SECTION_KEYS.map(
        (key) =>
          sections[key] && (
            <section key={key} className="card p-5">
              <h2 className="text-base font-bold text-forest">
                {t(`section.${key}` as never)}
              </h2>
              <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-ink">
                {sections[key]}
              </p>
            </section>
          )
      )}

      {gallery.length > 0 && (
        <section className="card p-5">
          <h2 className="text-base font-bold text-forest">{t("gallery")}</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {gallery.map((m) =>
              m.url ? (
                <a
                  key={m.id}
                  href={m.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block overflow-hidden rounded-xl border border-line"
                >
                  {m.kind === "photo" || m.kind === "receipt" ? (
                    // Signed URLs expire — plain img, not next/image optimizer
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.url}
                      alt={m.note || ""}
                      className="aspect-square w-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <span className="flex aspect-square items-center justify-center bg-forest text-xs font-bold text-white">
                      ▶ {t("video")}
                    </span>
                  )}
                  <span className="block px-2 py-1.5 text-[10px] text-muted">
                    {m.taken_at
                      ? `${t("taken")} ${new Date(m.taken_at).toLocaleString("en-GB", { timeZone: "Africa/Harare" })}`
                      : `${t("uploaded")} ${new Date(m.uploaded_at).toLocaleString("en-GB", { timeZone: "Africa/Harare" })}`}
                    {m.flagged_far && (
                      <span className="ml-1 font-bold text-red-700">
                        ⚠ {t("farFlag")}
                      </span>
                    )}
                    {typeof m.amount_cents === "number" &&
                      ` · ${formatCents(m.amount_cents)}`}
                  </span>
                </a>
              ) : null
            )}
          </div>
        </section>
      )}

      <p className="rounded-xl border border-line bg-white p-4 text-xs text-muted italic">
        {t("disclaimer")}
      </p>
    </div>
  );
}
