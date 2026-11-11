import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { site, waLink } from "@/config/site";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import { SERVICES, servicePath } from "@/config/services";

/** One footer for the website and the customer account. */
export default function SiteFooter({ logo = "/images/logo.jpg" }: { logo?: string }) {
  const t = useTranslations("site");
  const tc = useTranslations("common");
  const year = new Date().getFullYear();
  
  return (
    <footer className="bg-charcoal pb-24 text-[#d9d6cd] md:pb-10" data-testid="site-footer">
      <div className="ds-wrap grid gap-10 pt-14 md:grid-cols-12 md:gap-8 md:pt-16">
        <div className="md:col-span-4">
          <Link href="/" className="inline-flex items-center gap-3" aria-label={tc("brand")}>
            <span className="rounded-[4px] bg-paper p-1.5">
              <Image src={logo} alt="" width={96} height={76} className="h-9 w-auto" />
            </span>
            <span className="font-serif text-xl text-white">{tc("brand")}</span>
          </Link>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-[#b9b5aa]">{t("footer.about")}</p>
        </div>

        <nav aria-label={t("footer.servicesTitle")} className="md:col-span-3">
          <h2 className="text-xs font-semibold tracking-[0.14em] text-white uppercase">{t("footer.servicesTitle")}</h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            {SERVICES.map(({ key: s }) => (
              <li key={s}>
                <Link href={servicePath(s)} className="hover:text-white">
                  {t(`home.services.${s}.title`)}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/build-account" className="hover:text-white">{t("nav.buildAccount")}</Link>
            </li>
          </ul>
        </nav>

        <nav aria-label={t("footer.companyTitle")} className="md:col-span-2">
          <h2 className="text-xs font-semibold tracking-[0.14em] text-white uppercase">{t("footer.companyTitle")}</h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            {(["howItWorks", "about", "faq", "contact"] as const).map((k) => (
              <li key={k}>
                <Link href={k === "howItWorks" ? "/how-it-works" : `/${k}`} className="hover:text-white">
                  {t(`nav.${k}`)}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/login" className="hover:text-white">{tc("login")}</Link>
            </li>
          </ul>
        </nav>

        <div className="md:col-span-3">
          <h2 className="text-xs font-semibold tracking-[0.14em] text-white uppercase">{t("footer.contactTitle")}</h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li>
              <a href={`mailto:${site.email}`} className="hover:text-white">{site.email}</a>
            </li>
            <li>
              <a href={waLink()} target="_blank" rel="noopener noreferrer" className="hover:text-white">
                {t("footer.whatsapp")}
              </a>
            </li>
            <li className="text-[#b9b5aa]">{t("footer.based")}</li>
          </ul>
        </div>
      </div>

      <div className="ds-wrap mt-12 flex flex-col gap-4 border-t border-[#3a3d35] pt-6 text-xs text-[#a19d92] md:flex-row md:items-center md:justify-between">
        <p>© {year} {tc("brand")}. {t("footer.notABank")}</p>
        <div className="flex flex-wrap items-center gap-5">
          <Link href="/terms" className="hover:text-white">{t("footer.terms")}</Link>
          <Link href="/privacy" className="hover:text-white">{t("footer.privacy")}</Link>
          <LocaleSwitcher light />
        </div>
      </div>
    </footer>
  );
}
