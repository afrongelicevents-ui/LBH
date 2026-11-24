import type { PhotoSource } from "@/components/site/Photo";
import { PHOTOS } from "./photos";

/**
 * The photo spots the admin can also replace in Admin → Website photos.
 * Their default photos come from src/config/photos.ts (one file per spot).
 */
export type PagePhotoKey = "hero" | "land" | "materials" | "onsite" | "reporting" | "interiors";

export const STOCK_PHOTOS: Record<PagePhotoKey, PhotoSource> = {
  hero: PHOTOS.hero,
  land: PHOTOS.land,
  materials: PHOTOS.materials,
  onsite: PHOTOS.onsite,
  reporting: PHOTOS.reporting,
  interiors: PHOTOS.interiors,
};

/** Photo credits (About page). The placeholders are free-licence photos from Pexels. */
export const PHOTO_CREDITS = [
  { title: "Placeholder photos (homes, land, building, interiors)", author: "Pexels contributors", licence: "Pexels licence", url: "https://www.pexels.com/license/" },
];
export const HAVE_LICENSED_FILES = true;
