import { useTranslations } from "next-intl";
import {
  ShieldCheckIcon,
  HandshakeIcon,
  HouseCheckIcon,
} from "@/components/icons";

/** Full-width dark green band, three columns divided by thin gold lines (brief §4.1). */
export default function ProblemStrip() {
  const t = useTranslations("home.problems");

  const items = [
    { icon: ShieldCheckIcon, text: t("one") },
    { icon: HandshakeIcon, text: t("two") },
    { icon: HouseCheckIcon, text: t("three") },
  ];

  return (
    <section className="bg-forest text-white">
      <div className="mx-auto grid max-w-7xl grid-cols-3 px-2 py-6 sm:px-6 md:py-8 lg:px-8">
        {items.map((item, i) => (
          <div
            key={i}
            className={`flex flex-col items-center gap-2 px-2 text-center md:flex-row md:justify-center md:gap-3 md:px-6 ${
              i > 0 ? "border-l border-gold/60" : ""
            }`}
          >
            <item.icon width={30} height={30} className="shrink-0 text-gold" />
            <p className="text-xs leading-snug font-bold sm:text-sm md:text-base">
              {item.text}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
