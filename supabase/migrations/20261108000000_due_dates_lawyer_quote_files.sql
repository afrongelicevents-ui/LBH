-- ============================================================
-- Portal redesign support:
-- 1. jobs.due_date — set by admin when assigning; field staff can't move it.
-- 2. profiles.staff_kind — 'field_agent' or 'lawyer' (which portal a field
--    user sees). Comes from app_metadata (set only by the service role when
--    admin invites); users can't change it (no column grant).
-- 3. Supplier quote attachments (photo/PDF of the supplier's own quote) on
--    materials quotes and build-stage quotes. Files live in the private
--    "documents" bucket under quotes/<request>/<uuid>.<ext>.
-- ============================================================

-- ---------- 1. due dates ----------
alter table public.jobs add column if not exists due_date date;

create or replace function public.jobs_guard()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  -- auth.uid() is null: service role / maintenance scripts (not a user)
  if auth.uid() is not null and not public.is_admin() then
    if new.request_id is distinct from old.request_id
       or new.assigned_to is distinct from old.assigned_to
       or new.created_by is distinct from old.created_by
       or new.job_type is distinct from old.job_type
       or new.due_date is distinct from old.due_date then
      raise exception 'only admin may reassign a job';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

-- ---------- 2. staff kind ----------
alter table public.profiles
  add column if not exists staff_kind text
  check (staff_kind in ('field_agent', 'lawyer'));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_role public.user_role := coalesce((new.raw_app_meta_data->>'role')::public.user_role, 'client');
begin
  insert into public.profiles (id, role, full_name, email, whatsapp, country, locale, staff_kind)
  values (
    new.id,
    v_role,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.email, ''),
    new.raw_user_meta_data->>'whatsapp',
    new.raw_user_meta_data->>'country',
    coalesce(new.raw_user_meta_data->>'locale', 'en'),
    case
      when v_role = 'field' and new.raw_app_meta_data->>'staff_kind' = 'lawyer' then 'lawyer'
      when v_role = 'field' then 'field_agent'
      else null
    end
  )
  on conflict (id) do nothing;
  return new;
end $$;

update public.profiles set staff_kind = 'field_agent'
  where role = 'field' and staff_kind is null;

-- ---------- 3. supplier quote files ----------
alter table public.stage_quotes add column if not exists file_path text;

alter table public.stage_quotes drop constraint if exists stage_quotes_file_path_check;
alter table public.stage_quotes add constraint stage_quotes_file_path_check check (
  file_path is null or file_path ~
    '^quotes/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|pdf)$'
    and starts_with(file_path, 'quotes/' || request_id::text || '/'));

alter table public.supplier_quotes drop constraint if exists supplier_quotes_file_path_check;
alter table public.supplier_quotes add constraint supplier_quotes_file_path_check check (
  file_path is null or file_path ~
    '^quotes/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|pdf)$'
    and starts_with(file_path, 'quotes/' || request_id::text || '/'));
