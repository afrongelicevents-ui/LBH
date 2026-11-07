import { useTranslations } from "next-intl";
import {
  ShieldCheckIcon,
  HandshakeIcon,
  HouseCheckIcon,
} from "@/components/icons";

/**
 * Problem strip. Mobile (per phone mockup): light off-white band, dark green
 * icons, one row of three divided by thin #CFCBC0 lines, ~90px tall.
 * Desktop: full-width dark green band with white icons.
 */
export default function ProblemStrip() {
  const t = useTranslations("home.problems");

  const items = [
    { icon: ShieldCheckIcon, text: t("one") },
    { icon: HandshakeIcon, text: t("two") },
    { icon: HouseCheckIcon, text: t("three") },
  ];

  return (
    <section className="border-b border-line bg-offwhite md:border-0 md:bg-forest md:text-white">
      <div className="mx-auto grid max-w-7xl grid-cols-3 px-1 py-3.5 sm:px-6 md:py-8 lg:px-8">
        {items.map((item, i) => (
          <div
            key={i}
            className={`flex flex-col items-center gap-1.5 px-1.5 text-center md:flex-row md:justify-center md:gap-3 md:px-6 ${
              i > 0 ? "border-l border-line md:border-white/40" : ""
            }`}
          >
            <item.icon
              width={26}
              height={26}
              className="shrink-0 text-forest md:text-white"
            />
            <p className="text-xs leading-snug font-bold text-ink md:text-base md:text-white">
              {item.text}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
