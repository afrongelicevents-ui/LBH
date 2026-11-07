import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole } from "@/lib/auth/guard";
import { signedUrl } from "@/lib/uploads";
import { toneFor } from "@/lib/tones";
import { readLegal, LEGAL_ITEMS } from "@/lib/legal";
import { waLink } from "@/config/site";
import JobBoard, { type BoardJob } from "@/components/field/JobBoard";
import { WelcomeBanner, StatTiles, SectionHeader, HelpBox } from "@/components/ui/Portal";
import {
  BriefcaseIcon,
  CheckIcon,
  ClockIcon,
  FlagIcon,
  FileSearchIcon,
  FileClockIcon,
  ShieldCheckIcon,
  UsersIcon,
  ActivityIcon,
} from "@/components/ui/PortalIcons";

const PHOTO_KINDS = ["photo", "progress", "delivery", "inspection"];
/** Request statuses where the work waits on the client (quote, deposit). */
const WAITING_ON_CLIENT = ["new", "call_booked", "quote_sent", "accepted"];

function firstName(full: string) {
  return full.replace(/^SAMPLE\s+/i, "SAMPLE ").trim();
}

/** Field / Lawyer home: assigned jobs only — never prices (brief §6). */
export default async function FieldJobsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase, profile } = await requireRole(locale, ["field"]);
  const t = await getTranslations("field");
  const th = await getTranslations("field.home");
  const isLawyer = profile.staff_kind === "lawyer";

  const { data: jobs } = await supabase
    .from("jobs")
    .select(
      "id, job_type, status, due_date, created_at, updated_at, visit, request_id, client_first_name, service_requests(id, type, title, details, status)"
    )
    .order("created_at", { ascending: false });
  const list = jobs ?? [];
  const requestIds = Array.from(new Set(list.map((j) => j.request_id)));

  // Latest site photo per job (RLS: only media of the viewer's own jobs)
  const { data: media } = requestIds.length
    ? await supabase
        .from("media")
        .select("job_id, stage_id, request_id, storage_path, kind, uploaded_at")
        .in("request_id", requestIds)
        .in("kind", PHOTO_KINDS)
        .like("storage_path", "%.jpg")
        .order("uploaded_at", { ascending: false })
        .limit(300)
    : { data: [] };

  const nowDate = new Date();
  const nowMs = nowDate.getTime();
  const today = nowDate.toISOString().slice(0, 10);
  const dateFmt = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const board: BoardJob[] = await Promise.all(
    list.map(async (job) => {
      const req = job.service_requests as unknown as {
        type: string;
        title: string;
        details: Record<string, unknown>;
        status: string;
      } | null;
      const d = req?.details ?? {};
      const location =
        req?.type === "build"
          ? String(d.site_address ?? "").replace(/^SAMPLE\s+/, "")
          : [d.stand_number ? `${t("home.stand")} ${d.stand_number}` : "", d.town ?? ""].filter(Boolean).join(" · ");
      const m = (media ?? []).find(
        (x) => x.job_id === job.id || (x.stage_id && x.request_id === job.request_id)
      );
      const isTitle = job.job_type === "title_check";
      return {
        id: job.id,
        title: req?.title ?? "",
        location,
        clientFirstName: job.client_first_name ?? "",
        typeLabel: isTitle ? t("jobType.title_check") : t(`requestType.${req?.type}` as never),
        status: job.status,
        statusLabel: t(`jobStatus.${job.status}` as never),
        tone: toneFor(job.status),
        dueLabel: job.due_date ? th("due", { date: dateFmt.format(new Date(`${job.due_date}T12:00:00`)) }) : null,
        overdue: Boolean(job.due_date && job.due_date < today && !["submitted", "completed"].includes(job.status)),
        photoUrl: m ? await signedUrl("media", m.storage_path, 900) : null,
      };
    })
  );

  // Open jobs first, soonest due date first
  const rank = (st: string) => (st === "assigned" || st === "in_progress" ? 0 : 1);
  board.sort((a, b) => {
    const ja = list.find((j) => j.id === a.id)!;
    const jb = list.find((j) => j.id === b.id)!;
    return (
      rank(a.status) - rank(b.status) ||
      (ja.due_date ?? "9999").localeCompare(jb.due_date ?? "9999") ||
      String(jb.created_at).localeCompare(String(ja.created_at))
    );
  });

  const open = list.filter((j) => j.status === "assigned" || j.status === "in_progress");
  const done = list.filter((j) => j.status === "submitted" || j.status === "completed");

  const labels = {
    search: isLawyer ? th("searchLawyer") : th("search"),
    all: th("filterAll"),
    assigned: t("jobStatus.assigned"),
    inProgress: t("jobStatus.in_progress"),
    completed: t("jobStatus.completed"),
    viewDetails: th("viewDetails"),
    clientLabel: t("client"),
    noMatch: th("noMatch"),
    noJobs: t("noJobs"),
    noPhoto: th("noPhoto"),
    overdue: th("overdue"),
    actionReview: th("actionReview"),
    actionContinue: th("actionContinue"),
    actionView: th("actionView"),
  };
  const help = (
    <HelpBox title={th("helpTitle")} text={th("helpText")} cta={th("helpCta")} href={waLink(th("helpWhatsapp"))} />
  );

  if (!isLawyer) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <WelcomeBanner
          compact
          greeting={th("greeting")}
          name={firstName(profile.full_name || profile.email)}
          tagline={th("taglineField")}
          image="/images/hero.jpg"
        />
        <StatTiles
          tiles={[
            { label: th("tileAll"), value: list.length, icon: <BriefcaseIcon size={22} />, tone: "forest" },
            { label: t("jobStatus.assigned"), value: list.filter((j) => j.status === "assigned").length, icon: <CheckIcon size={22} />, tone: "ok" },
            { label: t("jobStatus.in_progress"), value: list.filter((j) => j.status === "in_progress").length, icon: <ClockIcon size={22} />, tone: "prog" },
            { label: th("tileDone"), value: done.length, icon: <FlagIcon size={22} />, tone: "done" },
          ]}
        />
        <h1 className="sr-only">{t("myJobs")}</h1>
        <JobBoard jobs={board} variant="field" labels={labels} />
        {help}
      </div>
    );
  }

  // ---------- Lawyer portal ----------
  const docsPending = open.reduce((n, j) => {
    const legal = readLegal(j.visit);
    return n + LEGAL_ITEMS.filter((k) => (legal.items[k]?.status ?? "pending") === "pending").length;
  }, 0);
  const awaitingClient = list.filter((j) =>
    WAITING_ON_CLIENT.includes((j.service_requests as unknown as { status: string } | null)?.status ?? "")
  ).length;

  // Recent activity: job updates + client documents on the lawyer's requests
  const { data: docs } = requestIds.length
    ? await supabase
        .from("documents")
        .select("request_id, file_name, created_at")
        .in("request_id", requestIds)
        .order("created_at", { ascending: false })
        .limit(5)
    : { data: [] };
  const titleOf = (rid: string) =>
    ((list.find((j) => j.request_id === rid)?.service_requests as unknown as { title: string } | null)?.title ?? "").replace(/^SAMPLE — /, "");
  const activity = [
    ...list.map((j) => ({
      at: j.updated_at as string,
      text: th("activityJob", { title: titleOf(j.request_id), status: t(`jobStatus.${j.status}` as never) }),
    })),
    ...(docs ?? []).map((d) => ({
      at: d.created_at as string,
      text: th("activityDoc", { title: titleOf(d.request_id) }),
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 4);
  const rtf = new Intl.RelativeTimeFormat(locale === "en" ? "en-GB" : locale, { numeric: "auto" });
  const ago = (iso: string) => {
    const mins = Math.round((Date.parse(iso) - nowMs) / 60000);
    if (Math.abs(mins) < 60) return rtf.format(mins, "minute");
    const hours = Math.round(mins / 60);
    if (Math.abs(hours) < 48) return rtf.format(hours, "hour");
    return rtf.format(Math.round(hours / 24), "day");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <WelcomeBanner
        greeting={th("greeting")}
        name={firstName(profile.full_name || profile.email)}
        tagline={th("taglineLawyer")}
        image="/images/land.jpg"
      />
      <StatTiles
        tiles={[
          { label: th("lawyerFiles"), value: open.length, icon: <FileSearchIcon size={22} />, tone: "forest" },
          { label: th("lawyerDocsPending"), value: docsPending, icon: <FileClockIcon size={22} />, tone: "prog" },
          { label: th("lawyerChecksDone"), value: done.length, icon: <ShieldCheckIcon size={22} />, tone: "done" },
          { label: th("lawyerAwaitingClient"), value: awaitingClient, icon: <UsersIcon size={22} />, tone: "ok" },
        ]}
      />
      <h1 className="sr-only">{t("myJobs")}</h1>
      <SectionHeader title={th("legalTasks")} />
      <JobBoard jobs={board} variant="lawyer" labels={labels} />

      <section className="card overflow-hidden">
        <div className="flex items-center gap-2 bg-ok-soft/60 px-4 py-3">
          <ActivityIcon size={20} className="text-forest" />
          <h2 className="text-base font-extrabold text-ink">{th("recentActivity")}</h2>
        </div>
        {activity.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted">{th("noActivity")}</p>
        ) : (
          <ul className="divide-y divide-[#eef0ef]">
            {activity.map((a, i) => (
              <li key={i} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                <span aria-hidden className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-ok-line" />
                <span className="min-w-0 flex-1 text-ink">{a.text}</span>
                <span className="shrink-0 text-xs text-muted">{ago(a.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      {help}
    </div>
  );
}
