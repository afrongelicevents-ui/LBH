import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { waLink } from "@/config/site";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import { WhatsAppIcon } from "@/components/icons";

const KEY_LINKS = [
  { href: "/services", key: "services" },
  { href: "/how-it-works", key: "howItWorks" },
  { href: "/build-account", key: "buildAccount" },
  { href: "/about", key: "about" },
  { href: "/faq", key: "faq" },
  { href: "/contact", key: "contact" },
] as const;

/** One short footer for the website and the customer account. */
export default function SiteFooter({ logo = "/images/logo.jpg" }: { logo?: string }) {
  const t = useTranslations("site");
  const tc = useTranslations("common");
  const year = new Date().getFullYear();

  return (
    <footer className="bg-charcoal pb-6 text-[#d9d6cd] md:pb-8" data-testid="site-footer">
      <div className="ds-wrap flex flex-col gap-5 pt-7 md:flex-row md:items-center md:justify-between md:pt-10">
        <Link href="/" className="inline-flex items-center gap-3" aria-label={tc("brand")}>
          <span className="rounded-[4px] bg-paper p-1">
            <Image src={logo} alt="" width={96} height={76} className="h-8 w-auto" />
          </span>
          <span className="font-serif text-lg text-white">{tc("brand")}</span>
        </Link>
        <nav aria-label={t("footer.linksTitle")}>
          <ul className="grid grid-cols-3 gap-x-4 gap-y-2.5 text-sm md:flex md:gap-6">
            {KEY_LINKS.map((l) => (
              <li key={l.key}>
                <Link href={l.href} className="hover:text-white">{t(`nav.${l.key}`)}</Link>
              </li>
            ))}
          </ul>
        </nav>
        {waLink() && (
          <a href={waLink()!} target="_blank" rel="noopener noreferrer" className="inline-flex w-fit items-center gap-2 rounded-[4px] border border-[#5d6157] px-3.5 py-2 text-sm text-white hover:border-white" data-testid="footer-whatsapp">
            <WhatsAppIcon width={18} height={18} />
            {t("footer.whatsapp")}
          </a>
        )}
      </div>

      <div className="ds-wrap mt-6 flex flex-col gap-3 border-t border-[#3a3d35] pt-4 text-xs text-[#a19d92] md:flex-row md:items-center md:justify-between">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>© {year} {tc("brand")}</span>
          <span aria-hidden>·</span>
          <Link href="/terms" className="hover:text-white">{t("footer.terms")}</Link>
          <span aria-hidden>·</span>
          <Link href="/privacy" className="hover:text-white">{t("footer.privacy")}</Link>
          <span aria-hidden>·</span>
          <Link href="/about#photo-credits" className="hover:text-white">{t("footer.photoCredits")}</Link>
        </p>
        <LocaleSwitcher light />
      </div>
    </footer>
  );
}
