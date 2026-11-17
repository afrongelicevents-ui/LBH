import { useTranslations } from "next-intl";
import { waLink } from "@/config/site";
import { WhatsAppIcon } from "./icons";

/** Floating WhatsApp button — bottom-right on every public page (brief §4).
 *  On phones it is a slim tab on the screen edge, so it never covers a button. */
export default function WhatsAppButton() {
  const t = useTranslations("common");
  const href = waLink();
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("whatsapp")}
      className="wa-float fixed right-0 bottom-24 z-50 flex h-10 w-[26px] items-center justify-center rounded-l-full bg-whatsapp pl-0.5 text-white shadow-lg transition-transform sm:right-6 sm:bottom-6 sm:h-12 sm:w-12 sm:rounded-full sm:pl-0 sm:hover:scale-105 md:h-14 md:w-14"
    >
      <WhatsAppIcon width={30} height={30} className="h-[18px] w-[18px] sm:h-[30px] sm:w-[30px]" />
    </a>
  );
}
