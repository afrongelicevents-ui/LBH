import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guard";
import StatusTimeline from "@/components/portal/StatusTimeline";
import { ChevronRightIcon } from "@/components/icons";
import type { RequestStatus } from "@/lib/status";

export default async function PortalDashboard({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase, user } = await requireRole(locale, ["client"]);
  const t = await getTranslations("portal.dashboard");

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
    <div className="space-y-6">
      <h1 className="headline text-2xl text-forest">{t("title")}</h1>

      {approvals && approvals.length > 0 && (
        <div className="rounded-2xl border border-gold bg-gold/10 p-4">
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
        <h2 className="mb-3 text-lg font-bold text-forest">{t("myRequests")}</h2>
        {!requests?.length ? (
          <div className="card p-6 text-center">
            <p className="text-sm text-muted">{t("noRequests")}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <Link href="/portal/requests/new-land" className="btn btn-gold text-sm">
                {t("startLand")}
              </Link>
              <Link
                href="/portal/requests/new-materials"
                className="btn btn-outline-green text-sm"
              >
                {t("startMaterials")}
              </Link>
            </div>
          </div>
        ) : (
          <ul className="space-y-3">
            {requests.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/portal/requests/${r.id}`}
                  className="card flex flex-col gap-3 p-4 transition-shadow hover:shadow-(--shadow-card-hover)"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-forest">{r.title}</p>
                    <ChevronRightIcon width={18} height={18} className="shrink-0 text-muted" />
                  </div>
                  <StatusTimeline status={r.status as RequestStatus} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {bookings && bookings.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold text-forest">{t("myCalls")}</h2>
          <ul className="space-y-2">
            {bookings.map((b) => (
              <li key={b.id} className="card flex items-center justify-between p-4 text-sm">
                <span className="font-semibold text-ink">
                  {t(`service.${b.service}` as never)} · {b.preferred_slot}
                </span>
                <span className="pill-soon">{t(`booking.${b.status}` as never)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
