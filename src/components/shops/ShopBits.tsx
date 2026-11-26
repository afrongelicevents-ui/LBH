import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

/** The fair-price promise (shown on every shop page). */
export async function FairPromise() {
  const t = await getTranslations("shops.promise");
  return (
    <section className="card p-5 md:p-6" aria-labelledby="fair-promise" data-testid="fair-promise">
      <h2 id="fair-promise" className="ds-h3">{t("title")}</h2>
      <ul className="mt-3 space-y-2.5">
        {(["p1", "p2", "p3", "p4"] as const).map((k) => (
          <li key={k} className="flex gap-2.5 text-[15px] leading-snug text-charcoal">
            <span aria-hidden className="mt-0.5 text-forest">✓</span>
            {t(k)}
          </li>
        ))}
      </ul>
    </section>
  );
}

export async function HowOrdering() {
  const t = await getTranslations("shops.how");
  return (
    <section className="card p-5 md:p-6" aria-labelledby="how-ordering">
      <h2 id="how-ordering" className="ds-h3">{t("title")}</h2>
      <ol className="mt-3 space-y-2.5">
        {(["s1", "s2", "s3", "s4"] as const).map((k, i) => (
          <li key={k} className="flex gap-3 text-[15px] leading-snug text-charcoal">
            <span aria-hidden className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-forest text-xs font-bold text-white">{i + 1}</span>
            {t(k)}
          </li>
        ))}
      </ol>
    </section>
  );
}

export async function JoinCta() {
  const t = await getTranslations("shops.join");
  return (
    <section className="border-t border-rule bg-paper">
      <div className="ds-wrap flex flex-col items-start gap-3 py-10 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="ds-h3">{t("cta")}</h2>
          <p className="ds-body mt-1 text-slate">{t("ctaText")}</p>
        </div>
        <Link href="/shops/join" className="ds-btn ds-btn-outline" data-testid="shops-join-cta">{t("cta")}</Link>
      </div>
    </section>
  );
}
