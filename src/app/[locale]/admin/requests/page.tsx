import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guard";
import { toneFor } from "@/lib/tones";
import { StatusBadge } from "@/components/ui/Portal";
import SearchableList from "@/components/ui/SearchableList";
import { ArrowRightIcon, DocIcon, HammerIcon, PinIcon, TruckIcon, UserIcon } from "@/components/ui/PortalIcons";

const TYPE_ICON = { land_verification: PinIcon, materials: TruckIcon, build: HammerIcon } as const;
const OPEN = ["new", "call_booked", "quote_sent", "accepted", "deposit_paid", "on_site"];
const DONE = ["report_ready", "balance_paid", "done"];

export default async function AdminRequestsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, ["admin"]);
  const t = await getTranslations("admin.requests");
  const ts = await getTranslations("portal.status");
  const tf = await getTranslations("field");

  const { data: requests } = await supabase
    .from("service_requests")
    .select("id, title, type, status, created_at, profiles:client_id(full_name, email)")
    .order("created_at", { ascending: false })
    .limit(200);

  const items = (requests ?? []).map((r) => {
    const client = r.profiles as unknown as { full_name: string; email: string } | null;
    const Icon = TYPE_ICON[r.type as keyof typeof TYPE_ICON] ?? DocIcon;
    const typeLabel = tf(`requestType.${r.type}` as never);
    const href = r.type === "build" ? `/admin/builds/${r.id}` : `/admin/requests/${r.id}`;
    return {
      key: r.id,
      text: `${r.title} ${client?.full_name ?? ""} ${client?.email ?? ""} ${typeLabel}`,
      group: r.status === "new" ? "new" : OPEN.includes(r.status) ? "open" : DONE.includes(r.status) ? "done" : "other",
      node: (
        <article className="card relative flex items-center gap-3 p-4">
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
            <p className="mt-0.5 flex flex-wrap gap-x-3 text-[13px] text-muted">
              <span className="flex items-center gap-1">
                <UserIcon size={15} />
                {client?.full_name || client?.email}
              </span>
              <span>{typeLabel}</span>
              <span>{new Date(r.created_at).toLocaleDateString(locale === "en" ? "en-GB" : locale)}</span>
            </p>
          </div>
          <Link href={href} className="btn-details relative z-10 hidden sm:inline-flex">
            {t("viewDetails")}
            <ArrowRightIcon size={16} />
          </Link>
        </article>
      ),
    };
  });

  return (
    <div className="space-y-4">
      <h1 className="section-title">{t("title")}</h1>
      <SearchableList
        items={items}
        searchLabel={t("search")}
        emptyLabel={t("empty")}
        filters={[
          { key: "all", label: t("filterAll") },
          { key: "new", label: t("filterNew"), groups: ["new"] },
          { key: "open", label: t("filterOpen"), groups: ["open"] },
          { key: "done", label: t("filterDone"), groups: ["done"] },
        ]}
      />
    </div>
  );
}
