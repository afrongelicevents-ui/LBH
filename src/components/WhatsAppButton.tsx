import { useTranslations } from "next-intl";
import { waLink } from "@/config/site";
import { WhatsAppIcon } from "./icons";

/** Floating WhatsApp button — bottom-right on every public page (brief §4). */
export default function WhatsAppButton() {
  const t = useTranslations("common");
  return (
    <a
      href={waLink()}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("whatsapp")}
      className="fixed right-4 bottom-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-whatsapp text-white shadow-lg transition-transform hover:scale-105 sm:right-6 sm:bottom-6"
    >
      <WhatsAppIcon width={30} height={30} />
    </a>
  );
}
