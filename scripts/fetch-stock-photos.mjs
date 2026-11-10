/**
 * Build step: download the five licensed Wikimedia Commons photos (CC BY-SA 4.0)
 * used until genuine LBH photos are uploaded, resize them, and record which ones
 * are available. Never fails the build: if a download fails, the site keeps its
 * labelled placeholders for that photo.
 */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const OUT = join(process.cwd(), "public", "images", "stock");
const MANIFEST = join(process.cwd(), "src", "config", "stockPhotos.generated.json");
const UA = "LBHWebsite/1.0 (https://letsbuildhome.co.zw; licensed stock photos)";
const PHOTOS = {
  hero: { url: "https://upload.wikimedia.org/wikipedia/commons/6/68/Zambia_-Bricklayer.jpg", width: 2400 },
  materials: { url: "https://upload.wikimedia.org/wikipedia/commons/f/fa/Zambia_-Block_making.jpg", width: 1600 },
  onsite: { url: "https://upload.wikimedia.org/wikipedia/commons/7/71/Zambia_-Constructing_a_house.jpg", width: 1600 },
  reporting: { url: "https://upload.wikimedia.org/wikipedia/commons/9/9a/Building_in_progress.jpg", width: 1600 },
  land: { url: "https://upload.wikimedia.org/wikipedia/commons/0/01/Two_garage_house.jpg", width: 1600 },
};

mkdirSync(OUT, { recursive: true });
const available = [];
for (const [key, p] of Object.entries(PHOTOS)) {
  const file = join(OUT, `${key}.jpg`);
  try {
    if (!existsSync(file)) {
      const res = await fetch(p.url, { headers: { "User-Agent": UA } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      // resized only — the photo itself is not altered
      await sharp(buf).rotate().resize({ width: p.width, withoutEnlargement: true }).jpeg({ quality: 80, mozjpeg: true, progressive: true }).toFile(file);
      await new Promise((r) => setTimeout(r, 1500)); // be polite to Wikimedia
    }
    available.push(key);
    console.log(`[stock-photos] ${key}: ok`);
  } catch (e) {
    console.warn(`[stock-photos] ${key}: not available (${e instanceof Error ? e.message : e}) — placeholder kept`);
  }
}
writeFileSync(MANIFEST, JSON.stringify({ available }, null, 2) + "\n");
