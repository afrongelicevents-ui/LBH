import type { PhotoSource } from "@/components/site/Photo";

/**
 * Licensed stock photographs (Wikimedia Commons, CC BY-SA 4.0) used until
 * genuine LBH project photos are uploaded. Each shows a visible credit with
 * the country it was taken in — they are never presented as LBH projects.
 * Photos are only resized (not otherwise altered).
 */
const WC = "CC BY-SA 4.0, Wikimedia Commons";
export type PagePhotoKey = "hero" | "land" | "materials" | "onsite" | "reporting" | "interiors";
const LICENSED_STOCK_PHOTOS: Record<PagePhotoKey, PhotoSource> = {
  hero: {
    src: "/images/stock/hero.jpg",
    kind: "stock",
    credit: `Zambia · Thatlowdownwoman, ${WC}`,
    alt: "Brick walls of a house going up, with a timber scaffold",
    position: "50% 12%",
  },
  land: {
    src: "/images/stock/land.jpg",
    kind: "stock",
    credit: `Botswana · Ttakhwiri, ${WC}`,
    alt: "A newly built house beside open residential plots",
  },
  materials: {
    src: "/images/stock/materials.jpg",
    kind: "stock",
    credit: `Zambia · Thatlowdownwoman, ${WC}`,
    alt: "Freshly made concrete blocks stacked in a block yard",
  },
  onsite: {
    src: "/images/stock/onsite.jpg",
    kind: "stock",
    credit: `Zambia · Thatlowdownwoman, ${WC}`,
    alt: "A builder laying bricks on the walls of a new house",
  },
  interiors: {
    src: "/images/stock/interiors.jpg",
    kind: "stock",
    credit: `South Africa · Deavmi, CC BY-SA 3.0, Wikimedia Commons`,
    alt: "A furnished living room with sofas, armchairs and lamps",
  },
  reporting: {
    src: "/images/stock/reporting.jpg",
    kind: "stock",
    credit: `Botswana · Ttakhwiri, ${WC}`,
    alt: "A concrete-block house shell at window level",
  },
};

/** Full credits (shown on the Photo credits section of the About page). */
export const PHOTO_CREDITS = [
  { title: "Zambia - Bricklayer", author: "Thatlowdownwoman", licence: "CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File:Zambia_-Bricklayer.jpg" },
  { title: "Zambia - Block making", author: "Thatlowdownwoman", licence: "CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File:Zambia_-Block_making.jpg" },
  { title: "Zambia - Constructing a house", author: "Thatlowdownwoman", licence: "CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File:Zambia_-Constructing_a_house.jpg" },
  { title: "Building in progress", author: "Ttakhwiri", licence: "CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File:Building_in_progress.jpg" },
  { title: "Two garage house", author: "Ttakhwiri", licence: "CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File:Two_garage_house.jpg" },
  { title: "Living Room 2", author: "Deavmi", licence: "CC BY-SA 3.0", url: "https://commons.wikimedia.org/wiki/File:Living_Room_2.jpg" },
];

/**
 * Any licensed file the build could not download is replaced by the existing
 * site image, labelled as a placeholder.
 */
import generated from "./stockPhotos.generated.json";
/** Which licensed files the build managed to download (see scripts/fetch-stock-photos.mjs). */
const AVAILABLE = new Set<string>(generated.available);
export const HAVE_LICENSED_FILES = AVAILABLE.size > 0;
const PLACEHOLDER = (src: string, alt: string): PhotoSource => ({ src, kind: "stock", credit: "Placeholder — to be replaced", alt });
const PLACEHOLDERS = {
  hero: PLACEHOLDER("/images/hero.jpg", LICENSED_STOCK_PHOTOS.hero.alt),
  land: PLACEHOLDER("/images/land.jpg", LICENSED_STOCK_PHOTOS.land.alt),
  materials: PLACEHOLDER("/images/materials.jpg", LICENSED_STOCK_PHOTOS.materials.alt),
  onsite: PLACEHOLDER("/images/monitoring.jpg", LICENSED_STOCK_PHOTOS.onsite.alt),
  reporting: PLACEHOLDER("/images/hero.jpg", LICENSED_STOCK_PHOTOS.reporting.alt),
  interiors: PLACEHOLDER("/images/hero.jpg", LICENSED_STOCK_PHOTOS.interiors.alt),
};
export const STOCK_PHOTOS = Object.fromEntries(
  (Object.keys(PLACEHOLDERS) as (keyof typeof PLACEHOLDERS)[]).map((k) => [k, AVAILABLE.has(k) ? LICENSED_STOCK_PHOTOS[k] : PLACEHOLDERS[k]])
) as typeof PLACEHOLDERS;
