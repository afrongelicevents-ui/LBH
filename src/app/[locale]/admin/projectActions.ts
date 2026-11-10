"use server";

import sharp from "sharp";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdminAction } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseUploadRefs, takeIncoming, uploadErrorCode } from "@/lib/uploads";
import { SITE_PHOTO_BUCKET } from "@/config/sitePhotos";

export type ProjectResult = { ok: true; id?: string } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const done = () => revalidatePath("/", "layout");

const projectSchema = z.object({
  title: z.string().trim().min(2).max(120),
  location: z.string().trim().max(120).default(""),
  stage: z.string().trim().max(80).default(""),
  summary: z.string().trim().max(1200).default(""),
});

/** Create or edit a project (unpublished until the admin publishes it). */
export async function saveProject(id: string | null, _prev: ProjectResult | null, fd: FormData): Promise<ProjectResult> {
  try {
    const { supabase, user } = await requireAdminAction();
    if (id && !UUID.test(id)) return { ok: false, error: "invalid" };
    const parsed = projectSchema.safeParse(Object.fromEntries(fd.entries()));
    if (!parsed.success) return { ok: false, error: "invalid" };
    const row = { ...parsed.data, updated_by: user.id };
    const res = id
      ? await supabase.from("projects").update(row).eq("id", id).select("id").single()
      : await supabase.from("projects").insert(row).select("id").single();
    if (res.error) return { ok: false, error: "db" };
    await supabase.rpc("admin_log_audit", { p_action: id ? "project.updated" : "project.created", p_entity: "project", p_entity_id: res.data.id, p_data: {} });
    done();
    return { ok: true, id: res.data.id };
  } catch {
    return { ok: false, error: "auth" };
  }
}

export async function setProjectPublished(id: string, published: boolean): Promise<ProjectResult> {
  try {
    const { supabase } = await requireAdminAction();
    if (!UUID.test(id)) return { ok: false, error: "invalid" };
    if (published) {
      // never publish an empty project
      const { count } = await supabase.from("project_photos").select("id", { count: "exact", head: true }).eq("project_id", id);
      if (!count) return { ok: false, error: "noPhotos" };
    }
    const { error } = await supabase.from("projects").update({ published }).eq("id", id);
    if (error) return { ok: false, error: "db" };
    await supabase.rpc("admin_log_audit", { p_action: published ? "project.published" : "project.unpublished", p_entity: "project", p_entity_id: id, p_data: {} });
    done();
    return { ok: true };
  } catch {
    return { ok: false, error: "auth" };
  }
}

export async function deleteProject(id: string): Promise<ProjectResult> {
  try {
    const { supabase } = await requireAdminAction();
    if (!UUID.test(id)) return { ok: false, error: "invalid" };
    const { data: photos } = await supabase.from("project_photos").select("storage_path").eq("project_id", id);
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) return { ok: false, error: "db" };
    if (photos?.length) await createAdminClient().storage.from(SITE_PHOTO_BUCKET).remove(photos.map((p) => p.storage_path));
    await supabase.rpc("admin_log_audit", { p_action: "project.deleted", p_entity: "project", p_entity_id: id, p_data: {} });
    done();
    return { ok: true };
  } catch {
    return { ok: false, error: "auth" };
  }
}

/** Add a genuine LBH photo to a project (resized, stored in the public website bucket). */
export async function addProjectPhoto(projectId: string, _prev: ProjectResult | null, fd: FormData): Promise<ProjectResult> {
  try {
    const { supabase, user } = await requireAdminAction();
    if (!UUID.test(projectId)) return { ok: false, error: "invalid" };
    const [ref] = parseUploadRefs(fd.get("uploads_json"));
    if (!ref) return { ok: false, error: "invalid" };
    const caption = String(fd.get("caption") ?? "").trim().slice(0, 200);
    const taken = String(fd.get("taken_on") ?? "");
    const takenOn = /^\d{4}-\d{2}-\d{2}$/.test(taken) ? taken : null;
    const f = await takeIncoming(user.id, ref, "site-photo");
    if (!f.isImage) return { ok: false, error: "filetype" };
    const { data: jpeg, info } = await sharp(f.buffer)
      .rotate()
      .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true, progressive: true })
      .toBuffer({ resolveWithObject: true });
    const admin = createAdminClient();
    const path = `projects/${crypto.randomUUID()}.jpg`;
    const { error: upErr } = await admin.storage.from(SITE_PHOTO_BUCKET).upload(path, jpeg, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
    if (upErr) return { ok: false, error: "upload" };
    const { error } = await supabase.from("project_photos").insert({ project_id: projectId, storage_path: path, caption, taken_on: takenOn, width: info.width, height: info.height });
    if (error) {
      await admin.storage.from(SITE_PHOTO_BUCKET).remove([path]);
      return { ok: false, error: "db" };
    }
    done();
    return { ok: true };
  } catch (e) {
    const code = uploadErrorCode(e);
    return { ok: false, error: code === "error" ? "auth" : code };
  }
}

export async function deleteProjectPhoto(photoId: string): Promise<ProjectResult> {
  try {
    const { supabase } = await requireAdminAction();
    if (!UUID.test(photoId)) return { ok: false, error: "invalid" };
    const { data: p } = await supabase.from("project_photos").select("storage_path, project_id").eq("id", photoId).maybeSingle();
    if (!p) return { ok: false, error: "invalid" };
    const { error } = await supabase.from("project_photos").delete().eq("id", photoId);
    if (error) return { ok: false, error: "db" };
    await createAdminClient().storage.from(SITE_PHOTO_BUCKET).remove([p.storage_path]);
    // a published project must keep at least one photo
    const { count } = await supabase.from("project_photos").select("id", { count: "exact", head: true }).eq("project_id", p.project_id);
    if (!count) await supabase.from("projects").update({ published: false }).eq("id", p.project_id);
    done();
    return { ok: true };
  } catch {
    return { ok: false, error: "auth" };
  }
}

/** Show or hide "Projects" in the website menu. */
export async function setProjectsInNav(show: boolean): Promise<ProjectResult> {
  try {
    const { supabase, user } = await requireAdminAction();
    const { error } = await supabase.from("settings").update({ projects_in_nav: show, updated_by: user.id, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) return { ok: false, error: "db" };
    await supabase.rpc("admin_log_audit", { p_action: show ? "projects.shown_in_menu" : "projects.hidden_from_menu", p_entity: "settings", p_entity_id: "1", p_data: {} });
    done();
    return { ok: true };
  } catch {
    return { ok: false, error: "auth" };
  }
}
