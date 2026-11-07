import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guard";
import { ChevronRightIcon } from "@/components/icons";

/** "My build": straight to the project when there is just one. */
export default async function MyBuildsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, ["client"]);
  const t = await getTranslations("build");

  const { data: builds } = await supabase
    .from("service_requests")
    .select("id, title")
    .eq("type", "build")
    .order("created_at", { ascending: false });

  if (builds?.length === 1) redirect({ href: `/portal/build/${builds[0].id}`, locale });

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="section-title text-2xl">{t("myBuild")}</h1>
      {!builds?.length ? (
        <p className="rounded-xl bg-info p-4 text-sm text-ink">{t("noBuildYet")}</p>
      ) : (
        <ul className="space-y-2">
          {builds.map((b) => (
            <li key={b.id}>
              <Link href={`/portal/build/${b.id}`} className="card flex items-center justify-between p-4">
                <span className="font-bold text-forest">{b.title}</span>
                <ChevronRightIcon width={18} height={18} className="text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
