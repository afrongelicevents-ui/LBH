import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { BaPage } from "@/lib/buildAccount/page";
import { CardIcon, HomeIcon, ListIcon, CameraIcon, ChartIcon, MoreIcon } from "@/components/ui/PortalIcons";

export type BaTab = "home" | "statement" | "sent" | "budget" | "family" | "plans" | "scan";

/** Frame of every Build Account screen: title, whose account, tabs, plan banner. */
export default async function BaShell({
  page,
  active,
  children,
}: {
  page: BaPage;
  active: BaTab | null;
  children: React.ReactNode;
}) {
  const t = await getTranslations("ba");
  const { ctx, data, shared, ownerQs } = page;
  const tabs: { key: BaTab; href: string }[] = [
    { key: "home", href: "/portal/build-account" },
    { key: "statement", href: "/portal/build-account/statement" },
    { key: "sent", href: "/portal/build-account/sent" },
    { key: "budget", href: "/portal/build-account/budget" },
    ...(ctx.isOwner
      ? ([
          { key: "family", href: "/portal/build-account/family" },
          { key: "plans", href: "/portal/build-account/plans" },
        ] as const)
      : []),
  ];

  const bottom: { key: "home" | "statement" | "scan" | "budget"; href: string; icon: React.ReactNode }[] = [
    { key: "home", href: "/portal/build-account", icon: <HomeIcon size={20} /> },
    { key: "statement", href: "/portal/build-account/statement", icon: <ListIcon size={20} /> },
    { key: "scan", href: "/portal/build-account/scan", icon: <CameraIcon size={20} /> },
    { key: "budget", href: "/portal/build-account/budget", icon: <ChartIcon size={20} /> },
  ];
  const more = tabs.filter((x) => !["home", "statement", "budget"].includes(x.key));

  return (
    <div className="mx-auto max-w-3xl space-y-4" data-testid="ba-shell">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="section-title text-2xl">
          <CardIcon size={22} className="text-forest" />
          {t("title")}
        </h1>
        {(shared.length > 0 || !ctx.isOwner) && (
          <nav aria-label={t("whose")} className="flex flex-wrap gap-1.5">
            <Link href="/portal/build-account" className="chip" aria-pressed={ctx.isOwner}>
              {t("mine")}
            </Link>
            {shared.map((s) => (
              <Link
                key={s.owner_id}
                href={`/portal/build-account?owner=${s.owner_id}`}
                className="chip"
                aria-pressed={!ctx.isOwner && ctx.ownerId === s.owner_id}
              >
                {s.name.replace(/^SAMPLE\s+/, "")}
              </Link>
            ))}
          </nav>
        )}
      </div>

      {!ctx.isOwner && (
        <p className="rounded-2xl bg-prog-soft p-3 text-sm text-ink" data-testid="ba-shared-note">
          {t(ctx.member?.role === "add" ? "sharedAdd" : "sharedView", { name: data.ownerName.replace(/^SAMPLE\s+/, "") })}
        </p>
      )}
      {data.plan === "expired" && (
        <p role="status" className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800" data-testid="ba-readonly">
          {t("readOnly")}{" "}
          {ctx.isOwner && (
            <Link href="/portal/build-account/plans" className="underline underline-offset-2">
              {t("renew")}
            </Link>
          )}
        </p>
      )}

      <nav aria-label={t("title")} className="-mx-1 hidden gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={`${tab.href}${tab.key === "family" || tab.key === "plans" ? "" : ownerQs}`}
            aria-current={active === tab.key ? "page" : undefined}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold whitespace-nowrap ${
              active === tab.key ? "bg-forest text-white" : "bg-white text-ink shadow-sm"
            }`}
          >
            {t(`tab.${tab.key}`)}
          </Link>
        ))}
      </nav>

      {children}

      <p className="pt-2 pb-20 text-center text-[11px] text-muted sm:pb-0">{t("notABank")}</p>

      {/* phone: bottom tab bar */}
      <nav aria-label={t("title")} className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] sm:hidden" data-testid="ba-bottom-nav">
        <ul className="grid grid-cols-5">
          {bottom.map((b) => (
            <li key={b.key}>
              <Link
                href={`${b.href}${ownerQs}`}
                aria-current={active === b.key ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${active === b.key ? "text-forest" : "text-muted"}`}
              >
                {b.icon}
                {t(`bottom.${b.key}`)}
              </Link>
            </li>
          ))}
          <li>
            <details className="group relative">
              <summary className={`flex cursor-pointer list-none flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${more.some((m) => m.key === active) ? "text-forest" : "text-muted"}`}>
                <MoreIcon size={20} />
                {t("bottom.more")}
              </summary>
              <div className="absolute right-2 bottom-full mb-2 w-48 rounded-2xl bg-white p-2 shadow-(--shadow-card)">
                {more.map((m) => (
                  <Link key={m.key} href={`${m.href}${m.key === "family" || m.key === "plans" ? "" : ownerQs}`} className="block rounded-xl px-3 py-2 text-sm font-semibold text-ink hover:bg-offwhite">
                    {t(`tab.${m.key}`)}
                  </Link>
                ))}
              </div>
            </details>
          </li>
        </ul>
      </nav>
    </div>
  );
}
