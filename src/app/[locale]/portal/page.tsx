import { getTranslations, setRequestLocale } from "next-intl/server";
import { getSitePhotos } from "@/lib/sitePhotos";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guard";
import StatusTimeline from "@/components/portal/StatusTimeline";
import type { RequestStatus } from "@/lib/status";
import FinanceTrackerCard from "@/components/FinanceTrackerCard";
import { toneFor } from "@/lib/tones";
import { WelcomeBanner, StatTiles, StatusBadge } from "@/components/ui/Portal";
import {
  ArrowRightIcon,
  BellIcon,
  CheckIcon,
  ClockIcon,
  DocIcon,
  HammerIcon,
  PinIcon,
  TruckIcon,
} from "@/components/ui/PortalIcons";

const TYPE_ICON = { land_verification: PinIcon, materials: TruckIcon, build: HammerIcon } as const;
const DONE = ["report_ready", "balance_paid", "done"];

export default async function PortalDashboard({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ welcome?: string }>;
}) {
  const { locale } = await params;
  const { welcome } = await searchParams;
  setRequestLocale(locale);
  const photos = await getSitePhotos();
  const { supabase, user, profile } = await requireRole(locale, ["client"]);
  const t = await getTranslations("portal.dashboard");
  const ts = await getTranslations("portal.status");
  const th = await getTranslations("field.home");
  const tf = await getTranslations("field");

  const [{ data: requests }, { data: approvals }, { data: bookings }] =
    await Promise.all([
      supabase
        .from("service_requests")
        .select("id, type, status, title, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("approvals")
        .select("id, request_id, title, amount_cents")
        .eq("status", "pending"),
      supabase
        .from("call_bookings")
        .select("id, service, status, preferred_slot, created_at")
        .eq("client_id", user.id)
        .order("created_at", { ascending: false })
        .limit(3),
    ]);

  return (
    <div className="space-y-5">
      <WelcomeBanner
        greeting={th("greeting")}
        name={(profile.full_name || profile.email).replace(/^SAMPLE\s+/, "")}
        tagline={t("tagline")}
        image={photos.monitoring}
      />
      <StatTiles
        tiles={[
          { label: t("tileRequests"), value: requests?.length ?? 0, icon: <DocIcon size={22} />, tone: "forest" },
          { label: t("tileWaiting"), value: approvals?.length ?? 0, icon: <BellIcon size={22} />, tone: "ok" },
          {
            label: t("tileInProgress"),
            value: (requests ?? []).filter((r) => !DONE.includes(r.status) && r.status !== "cancelled").length,
            icon: <ClockIcon size={22} />,
            tone: "prog",
          },
          { label: t("tileDone"), value: (requests ?? []).filter((r) => DONE.includes(r.status)).length, icon: <CheckIcon size={22} />, tone: "done" },
        ]}
      />

      {welcome === "1" && (
        <div role="status" className="rounded-2xl bg-ok-soft p-4 text-ink">
          <p className="text-sm font-bold text-forest">
            {t("welcomeTitle", { name: profile.full_name.split(" ")[0] || "" })}
          </p>
          <p className="mt-1 text-sm">{t("welcomeText")}</p>
        </div>
      )}

      <section className="card p-4 sm:p-5" aria-labelledby="next-step">
        <h2 id="next-step" className="text-base font-extrabold text-ink">
          {t("nextStepTitle")}
        </h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <Link href="/book-a-call" className="btn btn-green text-sm">
            {t("bookCall")}
          </Link>
          <Link href="/portal/requests/new-land" className="btn btn-outline-green text-sm">
            {t("startLand")}
          </Link>
          <Link href="/portal/requests/new-materials" className="btn btn-outline-green text-sm">
            {t("startMaterials")}
          </Link>
        </div>
      </section>

      {approvals && approvals.length > 0 && (
        <div className="rounded-2xl bg-prog-soft p-4 text-ink">
          <p className="text-sm font-bold text-forest">
            {t("pendingApprovals", { count: approvals.length })}
          </p>
          <ul className="mt-2 space-y-1">
            {approvals.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/portal/requests/${a.request_id}#approvals`}
                  className="text-sm font-semibold text-forest underline underline-offset-2"
                >
                  {a.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <section>
        <h1 className="section-title mb-3">{t("title")}</h1>
        {!requests?.length ? (
          <div className="card p-6 text-center">
            <p className="text-sm text-muted">{t("noRequests")}</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {requests.map((r) => {
              const Icon = TYPE_ICON[r.type as keyof typeof TYPE_ICON] ?? DocIcon;
              const href = r.type === "build" ? `/portal/build/${r.id}` : `/portal/requests/${r.id}`;
              return (
                <li key={r.id}>
                  <article className="card relative flex flex-col gap-3 p-4">
                    <div className="flex items-start gap-3">
                      <span className="icon-round icon-ok h-12 w-12">
                        <Icon size={24} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <StatusBadge tone={toneFor(r.status)}>{ts(r.status as never)}</StatusBadge>
                        <h2 className="mt-1.5 text-[15px] font-extrabold text-ink">
                          <Link href={href} className="after:absolute after:inset-0">
                            {r.title}
                          </Link>
                        </h2>
                        <p className="text-[13px] text-muted">{tf(`requestType.${r.type}` as never)}</p>
                      </div>
                    </div>
                    <StatusTimeline status={r.status as RequestStatus} />
                    <span className="btn-details pointer-events-none self-start">
                      {th("viewDetails")}
                      <ArrowRightIcon size={16} />
                    </span>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {bookings && bookings.length > 0 && (
        <section>
          <h2 className="section-title mb-3">{t("myCalls")}</h2>
          <ul className="space-y-2">
            {bookings.map((b) => (
              <li key={b.id} className="card flex items-center justify-between p-4 text-sm">
                <span className="font-semibold text-ink">
                  {t(`service.${b.service}` as never)} · {b.preferred_slot}
                </span>
                <StatusBadge tone={b.status === "confirmed" ? "ok" : b.status === "completed" ? "done" : b.status === "cancelled" ? "grey" : "prog"}>{t(`booking.${b.status}` as never)}</StatusBadge>
              </li>
            ))}
          </ul>
        </section>
      )}

      <FinanceTrackerCard portal />
    </div>
  );
}
