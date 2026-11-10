import "server-only";
import { cache } from "react";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

/** Published LBH projects with at least one photo (public data, read with the anon key). */
export const loadPublishedProjects = cache(async () => {
  try {
    const anon = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data } = await anon
      .from("projects")
      .select("id, title, location, stage, summary, project_photos(id, storage_path, caption, taken_on, width, height, sort)")
      .eq("published", true)
      .order("sort")
      .order("created_at", { ascending: false });
    return (data ?? []).filter((p) => (p.project_photos ?? []).length > 0);
  } catch {
    return [];
  }
});

/** "Projects" appears in the menu only when the admin switched it on AND there is real content. */
export const showProjectsInNav = cache(async (): Promise<boolean> => {
  try {
    const { data } = await createAdminClient().from("settings").select("projects_in_nav").eq("id", 1).single();
    if (!data?.projects_in_nav) return false;
    return (await loadPublishedProjects()).length > 0;
  } catch {
    return false;
  }
});
