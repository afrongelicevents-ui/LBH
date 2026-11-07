import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { getSitePhotos } from "@/lib/sitePhotos";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("notFound");
  const photos = await getSitePhotos();
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-offwhite px-4 py-24 text-center">
      <Image src={photos.logo} alt="LBH" width={88} height={70} className="mb-6 h-14 w-auto" />
      <h1 className="headline text-4xl text-forest">{t("title")}</h1>
      <p className="mt-4 text-muted">{t("text")}</p>
      <Link href="/" className="btn btn-primary mt-8">
        {t("home")}
      </Link>
    </main>
  );
}
