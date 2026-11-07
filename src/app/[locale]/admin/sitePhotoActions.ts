"use server";

import sharp from "sharp";
import { revalidatePath } from "next/cache";
import { requireAdminAction } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseUploadRefs, takeIncoming, uploadErrorCode } from "@/lib/uploads";
import { SITE_PHOTOS, SITE_PHOTO_BUCKET, type SitePhotoSlot } from "@/config/sitePhotos";

export type SitePhotoResult =
  | { ok: true; width?: number; height?: number }
  | { ok: false; error: string };

function slotDef(slot: string) {
  return SITE_PHOTOS.find((p) => p.slot === slot) ?? null;
}

/** The new photo shows on every page straight away. */
function refreshWebsite() {
  revalidatePath("/", "layout");
}

/**
 * Admin replaces a website photo. The browser uploaded it to the private
 * "incoming" bucket; here it is checked (real image type, size), resized
 * to the slot's maximum width, compressed, and published in the public
 * "site-photos" bucket under a new name (so no old copy is cached).
 */
export async function saveSitePhoto(
  slot: SitePhotoSlot,
  _prev: SitePhotoResult | null,
  formData: FormData
): Promise<SitePhotoResult> {
  try {
    const { supabase, user } = await requireAdminAction();
    const def = slotDef(slot);
    if (!def) return { ok: false, error: "invalid" };
    const [ref] = parseUploadRefs(formData.get("uploads_json"));
    if (!ref) return { ok: false, error: "invalid" };

    const f = await takeIncoming(user.id, ref, "site-photo");
    if (!f.isImage) return { ok: false, error: "filetype" };
    const { data: jpeg, info } = await sharp(f.buffer)
      .rotate()
      .resize({ width: def.maxWidth, height: def.maxWidth, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true, progressive: true })
      .toBuffer({ resolveWithObject: true });

    const admin = createAdminClient();
    const path = `${slot}/${crypto.randomUUID()}.jpg`;
    const { error: upErr } = await admin.storage
      .from(SITE_PHOTO_BUCKET)
      .upload(path, jpeg, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
    if (upErr) {
      console.error(`[site-photo] upload: ${upErr.message}`);
      return { ok: false, error: "upload" };
    }

    const { data: old } = await supabase.from("site_photos").select("storage_path").eq("slot", slot).maybeSingle();
    // Written with the admin's own session: the database also checks admin + 2FA
    const { error } = await supabase.from("site_photos").upsert({
      slot,
      storage_path: path,
      width: info.width,
      height: info.height,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      await admin.storage.from(SITE_PHOTO_BUCKET).remove([path]);
      return { ok: false, error: "db" };
    }
    if (old?.storage_path && old.storage_path !== path) {
      await admin.storage.from(SITE_PHOTO_BUCKET).remove([old.storage_path]);
    }
    await supabase.rpc("admin_log_audit", {
      p_action: "site_photo.replaced",
      p_entity: "site_photo",
      p_entity_id: slot,
      p_data: { slot, width: info.width, height: info.height },
    });
    refreshWebsite();
    return { ok: true, width: info.width, height: info.height };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "not authorised") return { ok: false, error: "auth" };
    console.error(`[site-photo] ${msg}`);
    return { ok: false, error: uploadErrorCode(e) };
  }
}

/** Admin goes back to the built-in photo for a slot. */
export async function resetSitePhoto(slot: SitePhotoSlot): Promise<SitePhotoResult> {
  try {
    const { supabase } = await requireAdminAction();
    if (!slotDef(slot)) return { ok: false, error: "invalid" };
    const { data: old } = await supabase.from("site_photos").select("storage_path").eq("slot", slot).maybeSingle();
    const { error } = await supabase.from("site_photos").delete().eq("slot", slot);
    if (error) return { ok: false, error: "db" };
    if (old?.storage_path) {
      await createAdminClient().storage.from(SITE_PHOTO_BUCKET).remove([old.storage_path]);
    }
    await supabase.rpc("admin_log_audit", {
      p_action: "site_photo.reset",
      p_entity: "site_photo",
      p_entity_id: slot,
      p_data: { slot },
    });
    refreshWebsite();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.message === "not authorised" ? "auth" : "error" };
  }
}
