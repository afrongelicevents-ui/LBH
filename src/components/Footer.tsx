import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { site, waLink } from "@/config/site";
import LocaleSwitcher from "./LocaleSwitcher";
import { MailIcon, MapPinIcon, WhatsAppIcon } from "./icons";

export default function Footer() {
  const t = useTranslations();

  return (
    <footer className="bg-forest text-white">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-6 lg:flex-row lg:flex-wrap lg:justify-between">
          {/* Logo + wordmark */}
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-12 items-center justify-center rounded-lg bg-white p-1">
              <Image
                src="/images/logo.jpg"
                alt=""
                width={44}
                height={36}
                className="h-9 w-auto"
              />
            </span>
            <span className="text-sm font-extrabold tracking-wide uppercase">
              {t("common.brandUpper")}
            </span>
          </div>

          <div className="flex flex-col items-center gap-4 text-sm sm:flex-row sm:gap-6">
            <a
              href={`mailto:${site.email}`}
              className="flex items-center gap-2 hover:text-gold"
            >
              <MailIcon width={18} height={18} />
              {site.email}
            </a>
            <a
              href={waLink()}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 hover:text-gold"
            >
              <WhatsAppIcon width={18} height={18} />
              {t("common.whatsapp")}
            </a>
            <LocaleSwitcher light />
            <span className="flex items-center gap-2">
              <MapPinIcon width={18} height={18} className="text-gold" />
              {t("common.basedIn")}
            </span>
          </div>

          <p className="text-sm font-semibold text-gold italic">
            {t("common.footerLine")}
          </p>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-white/15 pt-6 text-xs text-white/70 sm:flex-row">
          <p>
            © {new Date().getFullYear()} {t("common.brand")}
          </p>
          <div className="flex gap-5">
            <Link href="/terms" className="hover:text-gold">
              {t("nav.terms")}
            </Link>
            <Link href="/privacy" className="hover:text-gold">
              {t("nav.privacy")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
