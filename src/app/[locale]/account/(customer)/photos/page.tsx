import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guard";
import { loadAccount } from "@/lib/account/data";
import { signedUrl } from "@/lib/uploads";
import PageHead from "@/components/account/PageHead";

/** Project photographs — dated site photos the customer is allowed to see. */
export default async function PhotosPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, ["client"]);
  const d = await loadAccount(supabase);
  if (d.photos.length === 0) redirect({ href: "/account", locale });
  const t = await getTranslations("account.photos");
  const tn = await getTranslations("site.account");
  const list = await Promise.all(d.photos.slice(0, 120).map(async (p) => ({ ...p, url: (await signedUrl("media", p.path, 600).catch(() => null)) ?? "" })));
  const withFiles = list.filter((p) => p.url);
  if (withFiles.length === 0) redirect({ href: "/account", locale });
  const groups = new Map<string, typeof list>();
  for (const p of withFiles) groups.set(p.project, [...(groups.get(p.project) ?? []), p]);
  const fmt = (s: string) => new Date(s).toLocaleDateString(locale === "en" ? "en-GB" : locale, { day: "numeric", month: "short", year: "numeric" });
  return (
    <div data-testid="photos-page">
      <PageHead eyebrow={tn("photos")} title={t("title")} intro={t("intro")} />
      {[...groups.entries()].map(([project, ps]) => (
        <section key={project} className="mt-10" aria-label={project}>
          <h2 className="ds-h3">{project}</h2>
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {ps.filter((p) => p.url).map((p) => (
              <li key={p.id}>
                <a href={p.url} target="_blank" rel="noopener noreferrer" className="group block">
                  <span className="relative block aspect-[4/3] overflow-hidden bg-sand">
                    <Image src={p.url} alt={t("alt", { project, date: fmt(p.at) })} fill sizes="(min-width: 1024px) 25vw, 50vw" className="object-cover transition-opacity group-hover:opacity-90" unoptimized />
                  </span>
                  <span className="mt-1.5 block text-xs text-slate">{fmt(p.at)}{p.stage ? ` · ${p.stage}` : ""}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
