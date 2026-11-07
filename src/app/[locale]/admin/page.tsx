import { getTranslations, setRequestLocale } from "next-intl/server";
import { getSitePhotos } from "@/lib/sitePhotos";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guard";
import { formatCents } from "@/lib/money";
import { WelcomeBanner, StatTiles } from "@/components/ui/Portal";
import {
  CalendarIcon,
  CardIcon,
  ChatIcon,
  ChevronRightIcon,
  DocIcon,
  DollarIcon,
  FileSearchIcon,
  HammerIcon,
} from "@/components/ui/PortalIcons";

const BLOCK_ICON = {
  bookings: { icon: CalendarIcon, tone: "prog" },
  requests: { icon: DocIcon, tone: "ok" },
  reports: { icon: FileSearchIcon, tone: "done" },
  proofs: { icon: CardIcon, tone: "ok" },
  extras: { icon: DollarIcon, tone: "prog" },
  stages: { icon: HammerIcon, tone: "forest" },
  chats: { icon: ChatIcon, tone: "prog" },
} as const;

/** Admin "Needs you" queue (brief §8). */
export default async function AdminNeedsYouPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const photos = await getSitePhotos();
  const { supabase, profile } = await requireRole(locale, ["admin"]);
  const t = await getTranslations("admin.needsYou");
  const th = await getTranslations("field.home");
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

  const count = (k: string) => blocks.find((b) => b.key === k)?.count ?? 0;

  return (
    <div className="space-y-4">
      <WelcomeBanner
        greeting={th("greeting")}
        name={(profile.full_name || profile.email).replace(/\s*\(.*\)$/, "")}
        tagline={t("tagline")}
        image={photos.materials}
      />
      <StatTiles
        tiles={[
          { label: t("tileRequests"), value: count("requests") + count("bookings"), icon: <DocIcon size={22} />, tone: "forest" },
          { label: t("tileReports"), value: count("reports"), icon: <FileSearchIcon size={22} />, tone: "done" },
          { label: t("tileMoney"), value: count("proofs") + count("extras"), icon: <CardIcon size={22} />, tone: "ok" },
          { label: t("tileStages"), value: count("stages"), icon: <HammerIcon size={22} />, tone: "prog" },
        ]}
      />
      <h1 className="section-title">{t("title")}</h1>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {blocks.map((b) => {
          const meta = BLOCK_ICON[b.key as keyof typeof BLOCK_ICON];
          const Icon = meta.icon;
          return (
            <section key={b.key} className="card p-4">
              <div className="flex items-center gap-3">
                <span className={`icon-round icon-${meta.tone} h-10 w-10`}>
                  <Icon size={20} />
                </span>
                <h2 className="flex-1 text-[15px] font-extrabold text-ink">{t(`block.${b.key}` as never)}</h2>
                <span
                  className={`flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-extrabold ${
                    b.count > 0 ? "bg-forest text-white" : "bg-info text-muted"
                  }`}
                >
                  {b.count}
                </span>
              </div>
              {b.items.length > 0 ? (
                <ul className="mt-3 divide-y divide-[#eef0ef]">
                  {b.items.slice(0, 6).map((item, i) => (
                    <li key={i}>
                      <Link
                        href={item.href}
                        className="flex items-center gap-2 py-2 text-sm font-semibold text-ink hover:text-forest"
                      >
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        <ChevronRightIcon size={16} className="shrink-0 text-muted" />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-xs text-muted">{t("nothing")}</p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
