import { Link } from "@/i18n/navigation";
import Photo, { type PhotoSource } from "@/components/site/Photo";

/** Detail-screen hero: photo, back button, kicker and big title (Warm Sand). */
export default function DetailHero({
  photo,
  kicker,
  title,
  backHref,
  backLabel,
  stockLabel,
  tall = true,
  titleTestId,
}: {
  photo: PhotoSource;
  kicker: string;
  title: string;
  backHref?: string;
  backLabel?: string;
  stockLabel?: string;
  tall?: boolean;
  titleTestId?: string;
}) {
  return (
    <header className={`ws-dhero ${tall ? "h-[440px] md:h-[520px]" : "h-[320px] md:h-[420px]"}`}>
      <Photo photo={photo} sizes="100vw" priority className="absolute inset-0" stockLabel={stockLabel} creditClassName="!z-[3] !bg-transparent !text-[10px] !text-white/75" />
      <div className="ds-wrap relative h-full">
        {backHref && (
          <Link href={backHref} className="ws-icon-btn absolute top-4 left-5 z-[3] md:left-8" aria-label={backLabel}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
              <path d="m15 18-6-6 6-6" />
            </svg>
          </Link>
        )}
        <div className="absolute inset-x-5 bottom-6 z-[2] md:inset-x-8 md:bottom-12">
          <span className="ws-kicker !text-[#e8e1d6]">{kicker}</span>
          <h1 className="ws-dhero-title mt-2 max-w-[16ch]" data-testid={titleTestId}>{title}</h1>
        </div>
      </div>
    </header>
  );
}
