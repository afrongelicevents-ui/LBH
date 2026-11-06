import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import SectionTitle from "@/components/SectionTitle";
import { CheckCircleIcon, ChevronRightIcon } from "@/components/icons";
import { services } from "@/lib/services";

/**
 * Our Services (brief §4.2):
 * - Desktop: 4 cards in a row (2×2 on tablet), photo on top.
 * - Mobile: horizontal cards (photo thumbnail left ~35%, text right, chevron ›), stacked.
 */
export default function ServicesSection() {
  const t = useTranslations();

  return (
    <section className="bg-offwhite py-12 md:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionTitle>{t("home.services.title")}</SectionTitle>

        <div className="mt-8 flex flex-col gap-4 md:mt-10 md:grid md:grid-cols-2 md:gap-6 xl:grid-cols-4">
          {services.map((svc) => {
            const bullets = Array.from({ length: svc.bullets }, (_, i) =>
              t(`servicesData.${svc.key}.bullet${i + 1}`)
            );
            return (
              <Link
                key={svc.key}
                href={`/services#${svc.key}`}
                className="card group flex transition-shadow hover:shadow-(--shadow-card-hover) md:flex-col"
              >
                {/* Photo: thumbnail left on mobile (~35%), full-width top from md */}
                <div className="relative w-[35%] shrink-0 self-stretch md:aspect-3/2 md:w-full md:self-auto">
                  <Image
                    src={svc.image}
                    alt=""
                    fill
                    sizes="(min-width: 1280px) 25vw, (min-width: 768px) 50vw, 35vw"
                    className="object-cover"
                  />
                </div>

                <div className="flex flex-1 items-center gap-2 p-4 md:items-stretch md:p-5">
                  <div className="flex-1">
                    <h3 className="text-base leading-snug font-bold text-forest md:text-lg">
                      {t(`servicesData.${svc.key}.title`)}
                    </h3>

                    {svc.homeBullets && (
                      <ul className="mt-2.5 space-y-1.5 md:mt-3 md:space-y-2">
                        {bullets.map((b) => (
                          <li key={b} className="flex items-start gap-2">
                            <CheckCircleIcon
                              width={17}
                              height={17}
                              className="mt-0.5 shrink-0 text-gold"
                            />
                            <span className="text-xs leading-snug text-muted md:text-sm">
                              {b}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {svc.comingSoon && (
                      <span className="pill-soon mt-3">{t("common.comingSoon")}</span>
                    )}
                  </div>

                  <ChevronRightIcon
                    width={20}
                    height={20}
                    className="shrink-0 text-muted md:hidden"
                  />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
