/**
 * Photos on the public website that the admin can replace
 * (Admin Portal → Settings → Website photos). No custom photo = default.
 */
export type SitePhotoSlot = "hero" | "land" | "materials" | "monitoring" | "camera" | "live_feed" | "logo" | "onsite" | "reporting";

export interface SitePhotoDef {
  slot: SitePhotoSlot;
  /** built-in photo in /public */
  defaultSrc: string;
  /** longest side after automatic resizing */
  maxWidth: number;
  /** below this width the photo will look blurry (warning only) */
  minWidth: number;
  /** how it is shown, for the live preview */
  preview: "hero" | "card" | "banner" | "logo";
}

export const SITE_PHOTOS: SitePhotoDef[] = [
  { slot: "hero", defaultSrc: "/images/hero.jpg", maxWidth: 2400, minWidth: 2000, preview: "hero" },
  { slot: "land", defaultSrc: "/images/land.jpg", maxWidth: 1600, minWidth: 900, preview: "card" },
  { slot: "materials", defaultSrc: "/images/materials.jpg", maxWidth: 1600, minWidth: 900, preview: "card" },
  { slot: "onsite", defaultSrc: "/images/monitoring.jpg", maxWidth: 1600, minWidth: 900, preview: "card" },
  { slot: "reporting", defaultSrc: "/images/hero.jpg", maxWidth: 1600, minWidth: 900, preview: "card" },
  { slot: "logo", defaultSrc: "/images/logo.jpg", maxWidth: 800, minWidth: 300, preview: "logo" },
];

/** Older slots the redesigned site no longer shows (kept so old rows stay valid). */
export const RETIRED_SLOTS = ["monitoring", "camera", "live_feed"] as const;

export const SLOT_KEYS = SITE_PHOTOS.map((p) => p.slot);

export type SitePhotoUrls = Record<SitePhotoSlot, string>;

export const DEFAULT_PHOTOS: SitePhotoUrls = {
  ...(Object.fromEntries(SITE_PHOTOS.map((p) => [p.slot, p.defaultSrc])) as Record<string, string>),
  monitoring: "/images/monitoring.jpg",
  camera: "/images/camera.jpg",
  live_feed: "/images/live-feed.jpg",
} as SitePhotoUrls;

export const SITE_PHOTO_BUCKET = "site-photos";

/** Public URL of a stored site photo. */
export function sitePhotoUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${SITE_PHOTO_BUCKET}/${path}`;
}
