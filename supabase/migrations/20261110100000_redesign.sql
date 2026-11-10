-- LBH redesign (2026-11-10)
--  1. Website photos: two new slots (on-site management, progress reporting)
--     and an honest label per photo: a real LBH photo, or a stock photo with
--     its credit. Rows uploaded before this have no label and are not shown
--     on the redesigned pages (labelled placeholders are shown instead).
--  2. Projects: genuine LBH project photos managed by the admin. The public
--     page only shows published projects, and stays out of the menu until
--     the admin switches it on.

-- ---------- 1. website photos ----------
alter table public.site_photos drop constraint if exists site_photos_slot_check;
alter table public.site_photos add constraint site_photos_slot_check
  check (slot in ('hero','land','materials','monitoring','camera','live_feed','logo','onsite','reporting'));
alter table public.site_photos add column if not exists kind text check (kind in ('lbh', 'stock'));
alter table public.site_photos add column if not exists credit text not null default ''
  check (char_length(credit) <= 200);

-- ---------- 2. projects ----------
alter table public.settings add column if not exists projects_in_nav boolean not null default false;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 120),
  location text not null default '' check (char_length(location) <= 120),
  summary text not null default '' check (char_length(summary) <= 1200),
  stage text not null default '' check (char_length(stage) <= 80),
  published boolean not null default false,
  sort int not null default 0,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_photos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  storage_path text not null unique
    check (storage_path ~ '^projects/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'),
  caption text not null default '' check (char_length(caption) <= 200),
  taken_on date,
  width int check (width > 0),
  height int check (height > 0),
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists project_photos_project on public.project_photos (project_id, sort);

alter table public.projects enable row level security;
alter table public.project_photos enable row level security;

-- everyone may read published projects (and their photos); admin manages all
drop policy if exists projects_read on public.projects;
create policy projects_read on public.projects for select to anon, authenticated
  using (published or public.is_admin());
drop policy if exists projects_admin on public.projects;
create policy projects_admin on public.projects for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists project_photos_read on public.project_photos;
create policy project_photos_read on public.project_photos for select to anon, authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and (p.published or public.is_admin())));
drop policy if exists project_photos_admin on public.project_photos;
create policy project_photos_admin on public.project_photos for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select on public.projects, public.project_photos to anon, authenticated;
grant insert, update, delete on public.projects, public.project_photos to authenticated;

create or replace function public.projects_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists projects_touch on public.projects;
create trigger projects_touch before update on public.projects
  for each row execute function public.projects_touch();
