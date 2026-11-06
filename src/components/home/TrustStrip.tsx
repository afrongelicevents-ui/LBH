import { useTranslations } from "next-intl";
import SectionTitle from "@/components/SectionTitle";
import {
  ScalesIcon,
  ShieldCheckIcon,
  ReceiptIcon,
  LockIcon,
} from "@/components/icons";

/** Trust strip "You can count on us" (brief §4.5): off-white band, 4 items with line icons. */
export default function TrustStrip() {
  const t = useTranslations("home.trust");

  const items = [
    { icon: ScalesIcon, text: t("one") },
    { icon: ShieldCheckIcon, text: t("two") },
    { icon: ReceiptIcon, text: t("three") },
    { icon: LockIcon, text: t("four") },
  ];

  return (
    <section className="bg-offwhite py-10 md:py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionTitle>{t("title")}</SectionTitle>
        <div className="mt-7 grid grid-cols-2 gap-y-6 md:grid-cols-4">
          {items.map((item, i) => (
            <div
              key={i}
              className={`flex flex-col items-center gap-2 px-3 text-center md:flex-row md:justify-center md:gap-3 ${
                i > 0 ? "md:border-l md:border-line" : ""
              } ${i % 2 === 1 ? "border-l border-line md:border-line" : ""}`}
            >
              <item.icon width={26} height={26} className="shrink-0 text-forest" />
              <p className="text-xs font-semibold text-ink sm:text-sm">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
