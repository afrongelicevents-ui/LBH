import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { site, waLink } from "@/config/site";
import LocaleSwitcher from "./LocaleSwitcher";
import { MailIcon, MapPinIcon, WhatsAppIcon } from "./icons";

export default function Footer() {
  const t = useTranslations();
  const year = new Date().getFullYear();

  return (
    <footer>
      {/* ---------- Mobile (phone mockup): off-white, compact ---------- */}
      {/* extra bottom padding so the floating WhatsApp button never covers text */}
      <div className="bg-offwhite px-4 pt-5 pb-24 md:hidden">
        <div className="flex items-center justify-center text-sm font-semibold text-ink">
          <a href={`mailto:${site.email}`} className="flex items-center gap-1.5 px-3">
            <MailIcon width={16} height={16} className="text-forest" />
            {site.email}
          </a>
          <span aria-hidden className="h-5 w-px bg-gold" />
          <a
            href={waLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3"
          >
            <WhatsAppIcon width={16} height={16} className="text-forest" />
            WhatsApp
          </a>
        </div>
        <p className="mt-3 text-center text-sm font-bold text-gold italic">
          {t("common.footerLine")}
        </p>
        <div className="mt-4 flex items-center justify-center gap-4 text-xs text-muted">
          <span>© {year} {t("common.brand")}</span>
          <Link href="/terms">{t("nav.terms")}</Link>
          <Link href="/privacy">{t("nav.privacy")}</Link>
        </div>
      </div>

      {/* ---------- Desktop: dark green ---------- */}
      <div className="hidden bg-forest text-white md:block">
        <div className="mx-auto max-w-7xl px-6 py-10 lg:px-8">
          <div className="flex flex-row flex-wrap items-center justify-between gap-6">
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

            <div className="flex items-center gap-6 text-sm">
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

          <div className="mt-8 flex items-center justify-between gap-3 border-t border-white/15 pt-6 text-xs text-white/70">
            <p>© {year} {t("common.brand")}</p>
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
      </div>
    </footer>
  );
}
