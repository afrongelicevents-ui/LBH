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
 * How it works: 4 numbered steps in ONE row on every breakpoint.
 * Mobile: small dark green circles, 12px labels, small arrows between.
 * Desktop adds the line icons.
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
    <section className="bg-white py-6 md:py-16">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
        <SectionTitle>{t("title")}</SectionTitle>

        <div className="mt-4 flex items-start justify-between gap-1 md:mt-10 md:gap-2">
          {steps.map((step, i) => (
            <div key={i} className="flex min-w-0 flex-1 items-start gap-1 md:items-center md:gap-2">
              <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center md:gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-forest text-sm font-extrabold text-white md:h-12 md:w-12 md:text-lg">
                  {i + 1}
                </span>
                <step.icon
                  width={28}
                  height={28}
                  className="hidden shrink-0 text-forest md:block"
                />
                <p className="text-xs leading-snug font-bold [overflow-wrap:anywhere] hyphens-auto text-ink md:max-w-40 md:text-base">
                  {step.label}
                </p>
              </div>
              {i < steps.length - 1 && (
                <ArrowRightIcon
                  width={14}
                  height={14}
                  aria-hidden
                  className="mt-2 shrink-0 text-muted md:mt-0 md:h-6 md:w-6"
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
