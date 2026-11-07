import "server-only";
import { cache } from "react";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_PHOTOS, sitePhotoUrl, type SitePhotoSlot, type SitePhotoUrls } from "@/config/sitePhotos";

export interface StoredSitePhoto {
  slot: SitePhotoSlot;
  storage_path: string;
  width: number | null;
  height: number | null;
  updated_at: string;
}

/** Custom photos set by the admin (public data, read with the anon key). */
export const loadStoredSitePhotos = cache(async (): Promise<StoredSitePhoto[]> => {
  try {
    const anon = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const { data } = await anon.from("site_photos").select("slot, storage_path, width, height, updated_at");
    return (data ?? []) as StoredSitePhoto[];
  } catch {
    return []; // never break the website: fall back to the default photos
  }
});

/** URL for every slot: the admin's photo if set, else the built-in one. */
export const getSitePhotos = cache(async (): Promise<SitePhotoUrls> => {
  const urls: SitePhotoUrls = { ...DEFAULT_PHOTOS };
  for (const p of await loadStoredSitePhotos()) {
    if (p.slot in urls) urls[p.slot] = sitePhotoUrl(p.storage_path);
  }
  return urls;
});
