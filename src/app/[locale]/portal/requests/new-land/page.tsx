import { getTranslations, setRequestLocale } from "next-intl/server";
import LandRequestForm from "@/components/portal/LandRequestForm";

export default async function NewLandRequestPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("portal.forms");
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="headline mb-2 text-2xl text-forest">{t("landTitle")}</h1>
      <p className="mb-6 text-sm text-muted">{t("landIntro")}</p>
      <LandRequestForm />
    </div>
  );
}
