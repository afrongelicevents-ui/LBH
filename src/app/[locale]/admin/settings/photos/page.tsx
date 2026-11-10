import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guard";
import { loadStoredSitePhotos } from "@/lib/sitePhotos";
import { SITE_PHOTOS, sitePhotoUrl } from "@/config/sitePhotos";
import SitePhotoSlotCard from "@/components/admin/SitePhotoSlotCard";

/** Admin → Settings → Website photos: replace the public website photos. */
export default async function WebsitePhotosPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole(locale, ["admin"]);
  const t = await getTranslations("admin.photos");
  const stored = await loadStoredSitePhotos();

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <Link href="/admin/settings" className="text-xs font-semibold text-muted hover:text-forest">
          ← {t("backToSettings")}
        </Link>
        <h1 className="section-title mt-1 text-2xl">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("intro")}</p>
      </div>
      <div className="space-y-4">
        {SITE_PHOTOS.map((def) => {
          const custom = stored.find((s) => s.slot === def.slot);
          return (
            <SitePhotoSlotCard
              key={def.slot}
              def={def}
              currentUrl={custom ? sitePhotoUrl(custom.storage_path) : def.defaultSrc}
              custom={custom ? { width: custom.width, height: custom.height, updatedAt: custom.updated_at, kind: custom.kind, credit: custom.credit } : null}
            />
          );
        })}
      </div>
    </div>
  );
}
