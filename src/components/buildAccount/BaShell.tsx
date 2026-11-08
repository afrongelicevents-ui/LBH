import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { BaPage } from "@/lib/buildAccount/page";
import { CardIcon } from "@/components/ui/PortalIcons";

export type BaTab = "home" | "statement" | "sent" | "budget" | "family" | "plans";

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

      <nav aria-label={t("title")} className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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

      <p className="pt-2 text-center text-[11px] text-muted">{t("notABank")}</p>
    </div>
  );
}
