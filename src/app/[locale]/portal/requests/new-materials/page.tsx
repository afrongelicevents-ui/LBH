import { getTranslations, setRequestLocale } from "next-intl/server";
import MaterialsRequestForm from "@/components/portal/MaterialsRequestForm";

export default async function NewMaterialsRequestPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("portal.forms");
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="headline mb-2 text-2xl text-forest">{t("materialsTitle")}</h1>
      <p className="mb-6 text-sm text-muted">{t("materialsIntro")}</p>
      <MaterialsRequestForm />
    </div>
  );
}
