-- ============================================================
-- Client sign-up, camera-only field capture, offline uploads and
-- lawyer title-check jobs.
--
-- 1. jobs.job_type: 'site_visit' (field agent) or 'title_check'
--    (lawyer, legal checklist). Only admin sets or changes it.
-- 2. media: where a file came from (in-app camera / file upload),
--    GPS accuracy, and a client_ref so an upload replayed after a
--    dropped connection is stored once, never twice.
-- 3. stage purchases / inspections: same client_ref idempotency.
-- ============================================================

-- ---------- 1. job types ----------
alter table public.jobs
  add column if not exists job_type text not null default 'site_visit'
  check (job_type in ('site_visit', 'title_check'));

create or replace function public.jobs_guard()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    if new.request_id is distinct from old.request_id
       or new.assigned_to is distinct from old.assigned_to
       or new.created_by is distinct from old.created_by
       or new.job_type is distinct from old.job_type then
      raise exception 'only admin may reassign a job';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

-- ---------- 2. media provenance + idempotency ----------
alter table public.media
  add column if not exists capture_source text
    check (capture_source in ('camera', 'upload')),
  add column if not exists gps_accuracy_m numeric
    check (gps_accuracy_m is null or gps_accuracy_m >= 0),
  add column if not exists client_ref uuid;

create unique index if not exists media_client_ref_key
  on public.media (client_ref) where client_ref is not null;

-- ---------- 3. purchases / inspections idempotency ----------
alter table public.stage_purchases add column if not exists client_ref uuid;
create unique index if not exists stage_purchases_client_ref_key
  on public.stage_purchases (client_ref) where client_ref is not null;

alter table public.stage_inspections add column if not exists client_ref uuid;
create unique index if not exists stage_inspections_client_ref_key
  on public.stage_inspections (client_ref) where client_ref is not null;
