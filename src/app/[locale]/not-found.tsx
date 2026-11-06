import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("notFound");
  return (
    <div className="flex flex-col items-center justify-center bg-offwhite px-4 py-24 text-center">
      <h1 className="headline text-4xl text-forest">{t("title")}</h1>
      <p className="mt-4 text-muted">{t("text")}</p>
      <Link href="/" className="btn btn-gold mt-8">
        {t("home")}
      </Link>
    </div>
  );
}
