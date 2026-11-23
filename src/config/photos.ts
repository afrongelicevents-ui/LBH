import type { PhotoSource } from "@/components/site/Photo";

/**
 * EVERY PHOTO ON THE WEBSITE — one entry per spot.
 *
 * To replace a photo after the LBH photo shoot (no code changes):
 *   1. Put your new photo in  public/images/site/  with the SAME file name
 *      as below (for example a new  hero.jpg ), replacing the old file.
 *   2. If it is a genuine LBH photo, change  kind: "stock"  to  kind: "lbh"
 *      for that spot. That removes the small "Stock photo" label.
 *   3. Optional: update the  alt  text (read aloud to blind visitors) and
 *      position  (which part of the photo stays in view, e.g. "50% 30%").
 *
 * Photos can also be swapped without a new release in
 * Admin → Settings → Website photos for the spots listed there
 * (hero, land, materials, onsite, reporting, interiors).
 *
 * The current files are free-licence placeholders from Pexels, used by the
 * approved Warm Sand design until the photo shoot. They are labelled
 * "Stock photo" on the site so they are never mistaken for LBH projects.
 */
const PEXELS = "Pexels (placeholder)";
const stock = (file: string, alt: string, position?: string): PhotoSource => ({
  src: `/images/site/${file}`,
  kind: "stock",
  credit: PEXELS,
  alt,
  ...(position ? { position } : {}),
});

export const PHOTOS = {
  /** Home — the big photo at the top */
  hero: stock("hero.jpg", "A modern finished family home with a lawn", "40% 50%"),
  /** Home — "Your whole build, in your pocket" (behind the sample Build Account card) */
  homeAbroad: stock("home-abroad.jpg", "A woman relaxing on a sofa and checking her phone", "35% 50%"),
  /** Home and Services — the three big service tiles */
  serviceLand: stock("service-land.jpg", "A surveyor measuring a plot of land", "50% 30%"),
  serviceBuild: stock("service-build.jpg", "A building team at work on site"),
  serviceFinish: stock("service-finish.jpg", "A finished, furnished living room"),
  /** Home — live camera band (SAMPLE) */
  liveBand: stock("live-band.jpg", "A builder laying bricks on a wall"),
  /** Home — closing photo "Your keys. Your home." */
  closing: stock("closing.jpg", "A couple holding the keys to their new home", "50% 40%"),

  /** Land page (and the Land verification page) — top photo */
  land: stock("land.jpg", "Open land with trees, ready to be checked", "50% 30%"),
  /** Land buying page — top photo */
  landBuying: stock("land-buying.jpg", "A surveyor measuring a plot of land", "50% 30%"),
  /** Build page — top photo, and the photo further down */
  build: stock("build.jpg", "A building team at work on site"),
  buildPhoto: stock("build-photo.jpg", "Bricklaying on site"),
  /** Materials procurement page */
  materials: stock("materials.jpg", "Cement bags stacked in a store"),
  /** On-site management page */
  onsite: stock("onsite.jpg", "A building team at work on site"),
  /** Progress reporting page */
  reporting: stock("reporting.jpg", "Brick walls going up"),
  /** Finish (Interiors & furnishing) — top photo, and the photo further down */
  finish: stock("finish.jpg", "A finished, furnished living room"),
  finishPhoto: stock("finish-photo.jpg", "A modern kitchen"),
  interiors: stock("interiors.jpg", "A finished, furnished living room"),

  /** About page — top photo */
  about: stock("about.jpg", "A couple holding the keys to their new home"),
  /** Book a free call — photo above the form */
  book: stock("book.jpg", "A woman relaxing on a sofa and checking her phone", "50% 35%"),
  /** Sample live camera (visitors) — the three cameras */
  liveCam1: stock("live-cam-1.jpg", "Sample camera view of the build site"),
  liveCam2: stock("live-cam-2.jpg", "Sample camera view of the walls"),
  liveCam3: stock("live-cam-3.jpg", "Sample camera view of the store"),
  /** Welcome screen (new account) — the three "start with" cards */
  welcomeLand: stock("welcome-land.jpg", "A surveyor measuring a plot of land"),
  welcomeBuild: stock("welcome-build.jpg", "A building team at work"),
  welcomeFinish: stock("welcome-finish.jpg", "A furnished living room"),
} satisfies Record<string, PhotoSource>;

export type PhotoSpot = keyof typeof PHOTOS;

/**
 * Photos uploaded in Admin → Settings → Website photos are kept, but while
 * this is false the website shows the photos listed above instead (the
 * approved Warm Sand placeholders). Set to true to show the admin uploads
 * again for the spots they cover (hero, land, materials, onsite, reporting,
 * interiors).
 */
export const USE_ADMIN_UPLOADED_PHOTOS = false;

/** Logos (Warm Sand): dark letters for light backgrounds, cream letters for dark backgrounds and photos. */
export const LOGOS = {
  onLight: "/images/brand/logo-on-light.png",
  onDark: "/images/brand/logo-on-dark.png",
  width: 512,
  height: 447,
} as const;

/** Credits for the About page. */
export const PHOTO_CREDITS_NOTE = "Placeholder photos: Pexels (free licence), until the LBH photo shoot.";
