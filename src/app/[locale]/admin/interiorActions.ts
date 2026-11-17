"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdminAction } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseUploadRefs, storePrivate, takeIncoming, uploadErrorCode } from "@/lib/uploads";
import { syncFromLbh } from "@/lib/buildAccount/server";

export type InteriorAdminResult = { ok: true } | { ok: false; error: string };

const UUID = z.string().uuid();
const done = () => revalidatePath("/", "layout");

const itemSchema = z.object({
  room: z.string().trim().min(1).max(60),
  name: z.string().trim().min(1).max(160),
  shop: z.string().trim().max(120).default(""),
  qty: z.coerce.number().int().min(1).max(999).default(1),
  price: z.coerce.number().positive().max(1_000_000),
  link: z
    .string()
    .trim()
    .max(500)
    .default("")
    .refine((v) => v === "" || /^https?:\/\//.test(v)),
  note: z.string().trim().max(500).default(""),
});

async function interiorsRequest(supabase: Awaited<ReturnType<typeof requireAdminAction>>["supabase"], requestId: string) {
  const { data } = await supabase.from("service_requests").select("id, type, client_id").eq("id", requestId).maybeSingle();
  return data?.type === "interiors" ? data : null;
}

/** LBH proposes an item (furniture, appliance, curtains …) for a room. */
export async function addInteriorItem(requestId: string, _prev: InteriorAdminResult | null, fd: FormData): Promise<InteriorAdminResult> {
  try {
    const { supabase, user } = await requireAdminAction();
    if (!UUID.safeParse(requestId).success) return { ok: false, error: "invalid" };
    if (!(await interiorsRequest(supabase, requestId))) return { ok: false, error: "invalid" };
    const p = itemSchema.safeParse(Object.fromEntries(fd.entries()));
    if (!p.success) return { ok: false, error: "invalid" };
    const { price, ...rest } = p.data;
    const { error } = await supabase.from("interior_items").insert({
      ...rest,
      request_id: requestId,
      price_cents: Math.round(price * 100),
      created_by: user.id,
    });
    if (error) return { ok: false, error: "db" };
    done();
    return { ok: true };
  } catch {
    return { ok: false, error: "auth" };
  }
}

/** Remove an option the client has not chosen yet (or declined). */
export async function deleteInteriorItem(itemId: string): Promise<InteriorAdminResult> {
  try {
    const { supabase } = await requireAdminAction();
    if (!UUID.safeParse(itemId).success) return { ok: false, error: "invalid" };
    const { data, error } = await supabase.from("interior_items").delete().eq("id", itemId).in("status", ["option", "declined"]).select("id");
    if (error) return { ok: false, error: "db" };
    if (!data?.length) return { ok: false, error: "chosen" };
    done();
    return { ok: true };
  } catch {
    return { ok: false, error: "auth" };
  }
}

/**
 * Mark a chosen item bought (optionally with a receipt photo) or delivered.
 * Bought items appear in the client's Build Account as an LBH purchase.
 */
export async function markInteriorItem(itemId: string, to: "bought" | "delivered", fd: FormData | null): Promise<InteriorAdminResult> {
  try {
    const { supabase, user } = await requireAdminAction();
    if (!UUID.safeParse(itemId).success) return { ok: false, error: "invalid" };
    const { data: item } = await supabase.from("interior_items").select("id, request_id, name, qty, price_cents, status").eq("id", itemId).maybeSingle();
    if (!item) return { ok: false, error: "invalid" };
    const req = await interiorsRequest(supabase, item.request_id);
    if (!req) return { ok: false, error: "invalid" };
    if (to === "bought" && item.status !== "chosen") return { ok: false, error: "notChosen" };
    if (to === "delivered" && item.status !== "bought") return { ok: false, error: "notBought" };

    let receiptId: string | null = null;
    const [ref] = fd ? parseUploadRefs(fd.get("uploads_json")) : [];
    if (ref) {
      const f = await takeIncoming(user.id, ref, "site-photo");
      if (!f.isImage) return { ok: false, error: "filetype" };
      const path = await storePrivate("media", `interiors/${item.request_id}/receipts`, f.buffer, f.contentType, f.ext);
      const { data: m, error: mErr } = await supabase
        .from("media")
        .insert({
          request_id: item.request_id,
          uploader_id: user.id,
          kind: "receipt",
          storage_path: path,
          original_name: f.originalName,
          taken_at: f.exif.takenAt,
          amount_cents: item.qty * item.price_cents,
          note: item.name,
        })
        .select("id")
        .single();
      if (mErr) {
        await createAdminClient().storage.from("media").remove([path]);
        return { ok: false, error: "db" };
      }
      receiptId = m.id;
    }

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = to === "bought" ? { status: "bought", bought_at: now } : { status: "delivered", delivered_at: now };
    if (receiptId) patch.receipt_media_id = receiptId;
    const { error } = await supabase.from("interior_items").update(patch).eq("id", itemId).eq("status", item.status);
    if (error) return { ok: false, error: "db" };
    await syncFromLbh(req.client_id);
    done();
    return { ok: true };
  } catch (e) {
    const code = uploadErrorCode(e);
    return { ok: false, error: code === "error" ? "auth" : code };
  }
}

/** A dated photo of a room (private; the client sees it in their project). */
export async function addInteriorPhoto(requestId: string, _prev: InteriorAdminResult | null, fd: FormData): Promise<InteriorAdminResult> {
  try {
    const { supabase, user } = await requireAdminAction();
    if (!UUID.safeParse(requestId).success) return { ok: false, error: "invalid" };
    if (!(await interiorsRequest(supabase, requestId))) return { ok: false, error: "invalid" };
    const room = String(fd.get("room") ?? "").trim().slice(0, 60);
    if (!room) return { ok: false, error: "invalid" };
    const caption = String(fd.get("caption") ?? "").trim().slice(0, 200);
    const refs = parseUploadRefs(fd.get("uploads_json"));
    if (!refs.length) return { ok: false, error: "invalid" };
    const admin = createAdminClient();
    for (const ref of refs.slice(0, 10)) {
      const f = await takeIncoming(user.id, ref, "site-photo");
      if (!f.isImage) return { ok: false, error: "filetype" };
      const path = await storePrivate("media", `interiors/${requestId}`, f.buffer, f.contentType, f.ext);
      const takenOn = new Date(f.exif.takenAt ?? Date.now()).toISOString().slice(0, 10);
      const { error } = await supabase.from("interior_photos").insert({ request_id: requestId, room, storage_path: path, caption, taken_on: takenOn, uploaded_by: user.id });
      if (error) {
        await admin.storage.from("media").remove([path]);
        return { ok: false, error: "db" };
      }
    }
    done();
    return { ok: true };
  } catch (e) {
    const code = uploadErrorCode(e);
    return { ok: false, error: code === "error" ? "auth" : code };
  }
}

export async function deleteInteriorPhoto(photoId: string): Promise<InteriorAdminResult> {
  try {
    const { supabase } = await requireAdminAction();
    if (!UUID.safeParse(photoId).success) return { ok: false, error: "invalid" };
    const { data: p } = await supabase.from("interior_photos").select("storage_path").eq("id", photoId).maybeSingle();
    if (!p) return { ok: false, error: "invalid" };
    const { error } = await supabase.from("interior_photos").delete().eq("id", photoId);
    if (error) return { ok: false, error: "db" };
    await createAdminClient().storage.from("media").remove([p.storage_path]);
    done();
    return { ok: true };
  } catch {
    return { ok: false, error: "auth" };
  }
}
