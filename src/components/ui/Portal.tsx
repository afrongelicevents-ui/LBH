import Image from "next/image";
import type { Tone } from "@/lib/tones";
import { ArrowRightIcon, ShieldCheckIcon } from "./PortalIcons";

/** Coloured status pill with a dot. */
export function StatusBadge({
  tone,
  children,
  dot = true,
  className = "",
}: {
  tone: Tone;
  children: React.ReactNode;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span className={`badge badge-${tone} ${dot ? "badge-dot" : ""} ${className}`}>{children}</span>
  );
}

/**
 * Welcome banner: a photo with a dark fade and cream text (reads the same in light and dark).
 * `compact` keeps it short (field portal: jobs show straight away).
 */
export function WelcomeBanner({
  greeting,
  name,
  tagline,
  image,
  compact = false,
}: {
  greeting: string;
  name: string;
  tagline?: string;
  image: string;
  compact?: boolean;
}) {
  return (
    <section
      className={`relative overflow-hidden rounded-[28px] bg-[#2b2a25] text-[#f3ede4] ${
        compact ? "min-h-[104px] sm:min-h-[128px]" : "min-h-[150px] sm:min-h-[190px]"
      }`}
    >
      <Image src={image} alt="" fill priority sizes="(min-width: 1280px) 1200px, 100vw" className="object-cover" />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-[rgba(10,9,7,0.85)] via-[rgba(10,9,7,0.55)] to-[rgba(10,9,7,0.1)]" />
      <div className={`relative max-w-[78%] px-5 sm:px-7 ${compact ? "py-4 sm:py-5" : "py-6 sm:py-9"}`}>
        <p className={`${compact ? "text-sm" : "text-base sm:text-lg"} leading-tight font-medium text-[#e8e1d6]`}>{greeting}</p>
        <p
          className={`${compact ? "text-[1.6rem] sm:text-[2rem]" : "text-[2rem] sm:text-[2.6rem]"} mt-1 font-serif leading-[0.98] font-extrabold tracking-[-0.03em] break-words`}
        >
          {name}
        </p>
        {tagline && <p className="mt-2 text-xs font-medium text-[#e8e1d6] sm:text-sm">{tagline}</p>}
      </div>
    </section>
  );
}

export interface TileDef {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  tone: "forest" | "ok" | "prog" | "done";
}

/** Row of stat tiles: round icon, big number, label, coloured bottom line. */
export function StatTiles({ tiles }: { tiles: TileDef[] }) {
  return (
    <div className={`grid gap-2 sm:gap-3 ${tiles.length >= 4 ? "grid-cols-4" : "grid-cols-3"}`}>
      {tiles.map((t) => (
        <div key={t.label} className={`tile tile-${t.tone}`} data-testid="stat-tile">
          <span className={`icon-round icon-${t.tone} h-10 w-10 sm:h-12 sm:w-12`}>{t.icon}</span>
          <span className="text-xl leading-none font-extrabold text-ink sm:text-2xl">{t.value}</span>
          <span className="text-[11px] leading-tight font-semibold text-ink sm:text-sm">{t.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Section heading with a green bar, optional link on the right. */
export function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="section-title">{title}</h2>
      {action}
    </div>
  );
}

/** Dark green help box at the bottom of staff portals. */
export function HelpBox({
  title,
  text,
  cta,
  href,
}: {
  title: string;
  text: string;
  cta: string;
  href: string | null;
}) {
  return (
    <section className="flex items-center gap-3 rounded-[22px] bg-sand p-4 text-charcoal sm:p-5">
      <ShieldCheckIcon size={40} className="shrink-0 text-forest" />
      <div className="min-w-0 flex-1">
        <p className="text-base font-extrabold">{title}</p>
        <p className="text-sm text-slate">{text}</p>
      </div>
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary min-h-11 shrink-0 px-4 text-sm"
        >
          {cta}
          <ArrowRightIcon size={16} />
        </a>
      )}
    </section>
  );
}

/** Square photo tile; falls back to an icon placeholder (never stock photos). */
export function JobThumb({
  url,
  icon,
  label,
  className = "",
}: {
  url: string | null;
  icon: React.ReactNode;
  label: string;
  className?: string;
}) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
    <img src={url} alt={label} className={`rounded-2xl object-cover ${className}`} />
  ) : (
    <span
      role="img"
      aria-label={label}
      className={`flex flex-col items-center justify-center gap-1 rounded-2xl bg-offwhite text-muted ${className}`}
    >
      {icon}
    </span>
  );
}
