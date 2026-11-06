import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import SectionTitle from "@/components/SectionTitle";
import { CheckCircleIcon, ChevronRightIcon } from "@/components/icons";
import { services } from "@/lib/services";

/**
 * Our Services.
 * Mobile (phone mockup): 4 compact white cards stacked — rounded photo on the
 * left (~35% width, full card height), title + small bullets right, chevron.
 * Desktop: 4 cards in a row (2×2 tablet), photo on top.
 */
export default function ServicesSection() {
  const t = useTranslations();

  return (
    <section className="bg-offwhite py-6 md:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionTitle>{t("home.services.title")}</SectionTitle>

        <div className="mt-4 flex flex-col gap-3 md:mt-10 md:grid md:grid-cols-2 md:gap-6 xl:grid-cols-4">
          {services.map((svc) => {
            const bullets = Array.from({ length: svc.bullets }, (_, i) =>
              t(`servicesData.${svc.key}.bullet${i + 1}`)
            );
            return (
              <Link
                key={svc.key}
                href={`/services#${svc.key}`}
                className="card group flex p-2 transition-shadow hover:shadow-(--shadow-card-hover) md:flex-col md:p-0"
              >
                {/* Photo: rounded thumbnail left on mobile, full-width top from md */}
                <div className="relative w-[35%] shrink-0 self-stretch overflow-hidden rounded-lg md:aspect-3/2 md:w-full md:self-auto md:rounded-none">
                  <Image
                    src={svc.image}
                    alt=""
                    fill
                    sizes="(min-width: 1280px) 25vw, (min-width: 768px) 50vw, 35vw"
                    className="object-cover"
                  />
                </div>

                <div className="flex min-h-[104px] flex-1 items-center gap-1 py-1 pr-0.5 pl-3 md:min-h-0 md:items-stretch md:p-5">
                  <div className="flex-1">
                    <h3 className="text-base leading-snug font-bold text-forest md:text-lg">
                      {t(`servicesData.${svc.key}.title`)}
                    </h3>

                    {svc.homeBullets && (
                      <ul className="mt-1.5 space-y-1 md:mt-3 md:space-y-2">
                        {bullets.map((b) => (
                          <li key={b} className="flex items-start gap-1.5 md:gap-2">
                            <CheckCircleIcon
                              width={15}
                              height={15}
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
                      <span className="pill-soon mt-2 md:mt-3">
                        {t("common.comingSoon")}
                      </span>
                    )}
                  </div>

                  <ChevronRightIcon
                    width={20}
                    height={20}
                    className="shrink-0 text-forest md:hidden"
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
