import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole } from "@/lib/auth/guard";
import { TranslationReviewToggle } from "@/components/admin/AdminActions";

type Messages = Record<string, unknown>;

function flatten(obj: Messages, prefix = ""): [string, string][] {
  return Object.entries(obj).flatMap(([k, v]) => {
    if (k === "_meta") return [];
    const path = prefix ? `${prefix}.${k}` : k;
    return v && typeof v === "object"
      ? flatten(v as Messages, path)
      : [[path, String(v)] as [string, string]];
  });
}

/**
 * Translation review (brief §9): lists Shona/Ndebele strings still needing
 * native-speaker review; admin ticks them off as reviewed.
 */
export default async function AdminTranslationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { locale } = await params;
  const { lang } = await searchParams;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, ["admin"]);
  const t = await getTranslations("admin.translations");

  const target = lang === "nd" ? "nd" : "sn";
  const dir = join(process.cwd(), "messages");
  const targetMessages = JSON.parse(
    readFileSync(join(dir, `${target}.json`), "utf8")
  ) as Messages;
  const enMessages = JSON.parse(readFileSync(join(dir, "en.json"), "utf8")) as Messages;

  const needsReview = Boolean(
    (targetMessages._meta as { needs_review?: boolean } | undefined)?.needs_review
  );
  const entries = flatten(targetMessages);
  const enMap = new Map(flatten(enMessages));

  const { data: reviews } = await supabase
    .from("translation_reviews")
    .select("message_key, reviewed")
    .eq("locale", target);
  const reviewMap = new Map((reviews ?? []).map((r) => [r.message_key, r.reviewed]));
  const remaining = entries.filter(([key]) => !reviewMap.get(key)).length;

  return (
    <div className="space-y-4">
      <h1 className="headline text-2xl text-forest">{t("title")}</h1>
      <div className="flex items-center gap-3 text-sm">
        <a
          href="?lang=sn"
          className={`btn min-h-10 px-4 text-xs ${target === "sn" ? "btn-green" : "btn-outline-green"}`}
        >
          Shona
        </a>
        <a
          href="?lang=nd"
          className={`btn min-h-10 px-4 text-xs ${target === "nd" ? "btn-green" : "btn-outline-green"}`}
        >
          Ndebele
        </a>
        <span className="text-muted">
          {needsReview
            ? t("remaining", { count: remaining })
            : t("fileReviewed")}
        </span>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-line text-left text-muted uppercase">
              <th className="px-4 py-3">{t("key")}</th>
              <th className="px-4 py-3">English</th>
              <th className="px-4 py-3">{target === "sn" ? "Shona" : "Ndebele"}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {entries.slice(0, 400).map(([key, value]) => (
              <tr key={key} className="border-b border-line align-top last:border-0">
                <td className="px-4 py-2 font-mono text-[10px] text-muted">{key}</td>
                <td className="max-w-xs px-4 py-2 text-ink">{enMap.get(key)}</td>
                <td className="max-w-xs px-4 py-2 text-ink">{value}</td>
                <td className="px-4 py-2">
                  <TranslationReviewToggle
                    locale={target}
                    messageKey={key}
                    reviewed={Boolean(reviewMap.get(key))}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">{t("fileNote")}</p>
    </div>
  );
}
