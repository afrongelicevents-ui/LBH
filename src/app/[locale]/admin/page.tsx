import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guard";
import { formatCents } from "@/lib/money";

/** Admin "Needs you" queue (brief §8). */
export default async function AdminNeedsYouPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, ["admin"]);
  const t = await getTranslations("admin.needsYou");
  const tb = await getTranslations("build");

  const [
    { data: newBookings },
    { data: newRequests },
    { data: submittedReports },
    { data: paymentProofs },
    { data: pendingExtraCosts },
    { data: unreadChats },
    { data: stageWork },
  ] = await Promise.all([
    supabase
      .from("call_bookings")
      .select("id, name, service, preferred_slot, created_at")
      .eq("status", "new")
      .order("created_at"),
    supabase
      .from("service_requests")
      .select("id, title, type, created_at")
      .eq("status", "new")
      .order("created_at"),
    supabase
      .from("reports")
      .select("id, request_id, verdict, service_requests(title)")
      .eq("status", "submitted"),
    supabase
      .from("payments")
      .select("id, request_id, kind, amount_cents, proof_reference, service_requests(title)")
      .eq("status", "submitted"),
    supabase
      .from("extra_cost_requests")
      .select("id, request_id, title, amount_cents, service_requests(title)")
      .eq("status", "pending"),
    supabase
      .from("messages")
      .select("client_id, profiles:client_id(full_name)")
      .eq("read_by_admin", false),
    supabase
      .from("build_stages")
      .select("request_id, name, status, service_requests(title)")
      .in("status", ["quoting", "paid", "purchased", "delivered", "building"])
      .order("updated_at"),
  ]);

  const chatClients = Array.from(
    new Map(
      (unreadChats ?? []).map((m) => [
        m.client_id,
        (m.profiles as unknown as { full_name: string } | null)?.full_name ?? "",
      ])
    )
  );

  const blocks: {
    key: string;
    count: number;
    items: { label: string; href: string }[];
  }[] = [
    {
      key: "bookings",
      count: newBookings?.length ?? 0,
      items: (newBookings ?? []).map((b) => ({
        label: `${b.name} · ${b.service} · ${b.preferred_slot}`,
        href: "/admin/bookings",
      })),
    },
    {
      key: "requests",
      count: newRequests?.length ?? 0,
      items: (newRequests ?? []).map((r) => ({
        label: r.title,
        href: `/admin/requests/${r.id}`,
      })),
    },
    {
      key: "reports",
      count: submittedReports?.length ?? 0,
      items: (submittedReports ?? []).map((r) => ({
        label: `${(r.service_requests as unknown as { title: string })?.title ?? ""}`,
        href: `/admin/requests/${r.request_id}#report`,
      })),
    },
    {
      key: "proofs",
      count: paymentProofs?.length ?? 0,
      items: (paymentProofs ?? []).map((p) => ({
        label: `${(p.service_requests as unknown as { title: string })?.title ?? ""} · ${p.kind} · ${formatCents(p.amount_cents)}`,
        href: `/admin/requests/${p.request_id}#payments`,
      })),
    },
    {
      key: "extras",
      count: pendingExtraCosts?.length ?? 0,
      items: (pendingExtraCosts ?? []).map((e) => ({
        label: `${(e.service_requests as unknown as { title: string })?.title ?? ""} · ${e.title} · ${formatCents(e.amount_cents)}`,
        href: `/admin/requests/${e.request_id}#extras`,
      })),
    },
    {
      key: "stages",
      count: stageWork?.length ?? 0,
      items: (stageWork ?? []).map((st) => ({
        label: `${(st.service_requests as unknown as { title: string })?.title ?? ""} · ${st.name}: ${tb(`status.${st.status}` as never)}`,
        href: `/admin/builds/${st.request_id}`,
      })),
    },
    {
      key: "chats",
      count: chatClients.length,
      items: chatClients.map(([clientId, name]) => ({
        label: name || String(clientId),
        href: `/admin/chats/${clientId}`,
      })),
    },
  ];

  return (
    <div className="space-y-5">
      <h1 className="headline text-2xl text-forest">{t("title")}</h1>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {blocks.map((b) => (
          <section key={b.key} className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-forest">{t(`block.${b.key}` as never)}</h2>
              <span
                className={`flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-extrabold ${
                  b.count > 0 ? "bg-accent text-white" : "bg-info text-muted"
                }`}
              >
                {b.count}
              </span>
            </div>
            {b.items.length > 0 ? (
              <ul className="mt-3 space-y-1.5">
                {b.items.slice(0, 6).map((item, i) => (
                  <li key={i}>
                    <Link
                      href={item.href}
                      className="block truncate text-sm font-semibold text-ink hover:text-forest"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-muted">{t("nothing")}</p>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
