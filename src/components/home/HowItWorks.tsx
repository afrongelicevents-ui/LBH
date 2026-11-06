import { useTranslations } from "next-intl";
import SectionTitle from "@/components/SectionTitle";
import {
  PhoneIcon,
  QuoteDocIcon,
  HardHatIcon,
  CameraPhotoIcon,
  ArrowRightIcon,
} from "@/components/icons";

/**
 * How it works (brief §4.3): 4 numbered steps — green circles with white
 * numbers, line icons, joined by arrows. Vertical list on mobile.
 */
export default function HowItWorks() {
  const t = useTranslations("home.how");

  const steps = [
    { icon: PhoneIcon, label: t("step1") },
    { icon: QuoteDocIcon, label: t("step2") },
    { icon: HardHatIcon, label: t("step3") },
    { icon: CameraPhotoIcon, label: t("step4") },
  ];

  return (
    <section className="bg-white py-12 md:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionTitle>{t("title")}</SectionTitle>

        <div className="mt-8 flex flex-col gap-6 md:mt-10 md:flex-row md:items-start md:justify-between md:gap-2">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-4 md:flex-1 md:gap-2">
              <div className="flex items-center gap-4 md:flex-1 md:flex-col md:gap-3 md:text-center">
                <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-forest text-lg font-extrabold text-white">
                  {i + 1}
                </span>
                <step.icon width={28} height={28} className="shrink-0 text-forest" />
                <p className="text-sm font-bold text-ink md:max-w-40 md:text-base">
                  {step.label}
                </p>
              </div>
              {i < steps.length - 1 && (
                <ArrowRightIcon
                  width={24}
                  height={24}
                  aria-hidden
                  className="hidden shrink-0 text-muted md:block"
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
