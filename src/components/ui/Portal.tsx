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
 * Dark green welcome banner with a photo on the right.
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
      className={`relative overflow-hidden rounded-[26px] bg-forest text-white shadow-(--shadow-card) ${
        compact ? "min-h-[92px] sm:min-h-[120px]" : "min-h-[132px] sm:min-h-[170px]"
      }`}
    >
      <div className="absolute inset-y-0 right-0 w-[52%]">
        <Image src={image} alt="" fill priority sizes="(min-width: 768px) 40vw, 55vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-forest via-forest/40 to-transparent" />
      </div>
      <div className={`relative max-w-[62%] px-5 ${compact ? "py-4" : "py-6 sm:py-8"}`}>
        <p className={`${compact ? "text-base" : "text-lg sm:text-xl"} leading-tight font-medium`}>{greeting}</p>
        <p
          className={`${compact ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl"} leading-tight font-extrabold tracking-tight break-words`}
        >
          {name}
        </p>
        {tagline && <p className="mt-1 text-xs font-medium text-white/85 sm:text-sm">{tagline}</p>}
        <span aria-hidden className="mt-2 block h-1 w-14 rounded-full bg-ok-line" />
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
  href: string;
}) {
  return (
    <section className="flex items-center gap-3 rounded-[22px] bg-forest p-4 text-white sm:p-5">
      <ShieldCheckIcon size={40} className="shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-base font-extrabold">{title}</p>
        <p className="text-sm text-white/85">{text}</p>
      </div>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border-2 border-white px-4 text-sm font-bold text-white hover:bg-white hover:text-forest"
      >
        {cta}
        <ArrowRightIcon size={16} />
      </a>
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
