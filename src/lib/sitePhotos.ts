import "server-only";
import { cache } from "react";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_PHOTOS, sitePhotoUrl, type SitePhotoSlot, type SitePhotoUrls } from "@/config/sitePhotos";
import { STOCK_PHOTOS, type PagePhotoKey } from "@/config/stockPhotos";
import { USE_ADMIN_UPLOADED_PHOTOS } from "@/config/photos";
import type { PhotoSource } from "@/components/site/Photo";

export interface StoredSitePhoto {
  slot: SitePhotoSlot;
  storage_path: string;
  width: number | null;
  height: number | null;
  updated_at: string;
  kind: "lbh" | "stock" | null;
  credit: string;
}

/** Custom photos set by the admin (public data, read with the anon key). */
export const loadStoredSitePhotos = cache(async (): Promise<StoredSitePhoto[]> => {
  try {
    const anon = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const { data } = await anon.from("site_photos").select("slot, storage_path, width, height, updated_at, kind, credit");
    return (data ?? []) as StoredSitePhoto[];
  } catch {
    return []; // never break the website: fall back to the default photos
  }
});

/** URL for every slot: the admin's photo if set, else the built-in one. */
export const getSitePhotos = cache(async (): Promise<SitePhotoUrls> => {
  const urls: SitePhotoUrls = { ...DEFAULT_PHOTOS };
  const pageSlots = ["hero", "land", "materials", "onsite", "reporting", "interiors"];
  for (const p of await loadStoredSitePhotos()) {
    // page photos follow src/config/photos.ts unless admin uploads are switched on there
    if (!USE_ADMIN_UPLOADED_PHOTOS && pageSlots.includes(p.slot)) continue;
    if (p.slot in urls) urls[p.slot] = sitePhotoUrl(p.storage_path);
  }
  return urls;
});

/**
 * Photos for the redesigned pages: an admin photo is used only when it is
 * labelled (real LBH photo, or stock with a credit); otherwise the licensed
 * stock / placeholder photo with its visible credit.
 */
export const getPagePhotos = cache(async (): Promise<Record<PagePhotoKey, PhotoSource>> => {
  const out = { ...STOCK_PHOTOS };
  if (!USE_ADMIN_UPLOADED_PHOTOS) return out;
  for (const p of await loadStoredSitePhotos()) {
    if (!(p.slot in out) || !p.kind) continue;
    const key = p.slot as keyof typeof out;
    out[key] = { src: sitePhotoUrl(p.storage_path), kind: p.kind, credit: p.credit || undefined, alt: STOCK_PHOTOS[key].alt };
  }
  return out;
});

/** Before/after gallery on the interiors page: only admin uploads (no stock). */
export const getInteriorGallery = cache(async () => {
  const stored = await loadStoredSitePhotos();
  const url = (slot: string) => {
    const p = stored.find((x) => x.slot === slot);
    return p ? sitePhotoUrl(p.storage_path) : null;
  };
  return [1, 2, 3].map((n) => ({ n, before: url(`interiors_before_${n}`), after: url(`interiors_after_${n}`) }));
});

/** A logo the admin uploaded in Website photos, or null = the Warm Sand logo. */
export const getCustomLogo = cache(async (): Promise<string | null> => {
  const p = (await loadStoredSitePhotos()).find((x) => x.slot === "logo");
  return p ? sitePhotoUrl(p.storage_path) : null;
});
