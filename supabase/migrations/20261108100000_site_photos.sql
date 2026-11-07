-- ============================================================
-- Website photos the admin can change without code.
--   * site_photos: one row per slot that has a custom photo (no row =
--     the built-in default photo is used). Everyone may read; only an
--     admin with 2FA (is_admin) may change it.
--   * Files live in the PUBLIC bucket "site-photos" (they are shown on
--     the public website). Only the server (service role, after an admin
--     check) writes there: there are no storage policies for users.
-- ============================================================

create table if not exists public.site_photos (
  slot text primary key
    check (slot in ('hero','land','materials','monitoring','camera','live_feed','logo')),
  storage_path text not null
    check (storage_path ~ '^[a-z_]+/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'
           and starts_with(storage_path, slot || '/')),
  width int check (width > 0),
  height int check (height > 0),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.site_photos enable row level security;

drop policy if exists site_photos_read on public.site_photos;
create policy site_photos_read on public.site_photos
  for select to anon, authenticated using (true);

drop policy if exists site_photos_admin_write on public.site_photos;
create policy site_photos_admin_write on public.site_photos
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.site_photos to anon, authenticated;
grant insert, update, delete on public.site_photos to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-photos', 'site-photos', true, 10485760, array['image/jpeg'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
