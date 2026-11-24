import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import Logo from "@/components/ws/Logo";

export default async function NotFound() {
  const t = await getTranslations("notFound");
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-ivory px-5 py-24 text-center text-charcoal">
      <Logo className="mb-6 h-16 w-auto" />
      <h1 className="headline text-[2.4rem]">{t("title")}</h1>
      <p className="mt-4 max-w-[34ch] text-slate">{t("text")}</p>
      <Link href="/" className="btn btn-primary mt-8">
        {t("home")}
      </Link>
    </main>
  );
}
