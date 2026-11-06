import { useTranslations } from "next-intl";
import SectionTitle from "@/components/SectionTitle";

/** Shared renderer for Terms and Privacy pages. */
export default function LegalPage({
  namespace,
  sections,
}: {
  namespace: "termsPage" | "privacyPage";
  sections: number;
}) {
  const t = useTranslations(namespace);

  return (
    <div className="bg-offwhite py-12 md:py-16">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <SectionTitle as="h1">{t("title")}</SectionTitle>
        <p className="mt-3 text-center text-xs text-muted">
          {t("updated")}: 2026-11-06
        </p>
        <p className="mt-6 text-sm leading-relaxed text-muted md:text-base">
          {t("intro")}
        </p>
        <div className="card mt-8 divide-y divide-line">
          {Array.from({ length: sections }, (_, i) => i + 1).map((n) => (
            <section key={n} className="p-6">
              <h2 className="text-base font-bold text-forest md:text-lg">
                {t(`s${n}Title`)}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted md:text-base">
                {t(`s${n}Text`)}
              </p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
