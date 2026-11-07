-- ============================================================
-- Build-stage hardening (from the security review)
--
-- 1. Purchases and inspections are append-only for users (incl. admin):
--    the buyer ≠ inspector rule can't be dodged by editing/deleting rows.
-- 2. Only a real client can approve quotes/stages, and a request's client
--    can never be changed after creation (no "posing as the client").
-- 3. Field staff can't read stage purchase amounts or other people's
--    receipt amounts (no prices for field staff).
-- 4. Media rows can't be attached across projects; storage paths must be
--    exactly <prefix>/<uuid>/<uuid>.<ext> (no "..").
-- ============================================================

-- ---------- 1. append-only purchases & inspections ----------
create function public.append_only_guard()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null then
    raise exception '% records cannot be changed or deleted', tg_table_name;
  end if;
  return coalesce(new, old);
end $$;

create trigger stage_purchases_append_only
  before update or delete on public.stage_purchases
  for each row execute function public.append_only_guard();
create trigger stage_inspections_append_only
  before update or delete on public.stage_inspections
  for each row execute function public.append_only_guard();

-- ---------- 2. client identity is fixed; approvals need a real client ----------
create function public.service_requests_guard()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null and new.client_id is distinct from old.client_id then
    raise exception 'the client of a request cannot be changed';
  end if;
  if auth.uid() is not null and new.type is distinct from old.type then
    raise exception 'the type of a request cannot be changed';
  end if;
  return new;
end $$;

create trigger service_requests_guard
  before update on public.service_requests
  for each row execute function public.service_requests_guard();

create function public.assert_client()
returns void language plpgsql stable security definer set search_path = public
as $$
begin
  if public.current_user_role() is distinct from 'client' then
    raise exception 'only the client can do this';
  end if;
end $$;

-- Wrap the client decision RPCs with a role check.
create or replace function public.approve_stage_quote_checked(p_quote_id uuid)
returns uuid language plpgsql security definer set search_path = public
as $$ begin perform public.assert_client(); return public._approve_stage_quote(p_quote_id); end $$;

alter function public.approve_stage_quote(uuid) rename to _approve_stage_quote;
alter function public.approve_stage_quote_checked(uuid) rename to approve_stage_quote;
revoke execute on function public._approve_stage_quote(uuid) from public, anon, authenticated;
revoke execute on function public.approve_stage_quote(uuid) from public, anon;
grant execute on function public.approve_stage_quote(uuid) to authenticated;

create or replace function public.approve_stage_checked(p_stage_id uuid)
returns void language plpgsql security definer set search_path = public
as $$ begin perform public.assert_client(); perform public._approve_stage(p_stage_id); end $$;

alter function public.approve_stage(uuid) rename to _approve_stage;
alter function public.approve_stage_checked(uuid) rename to approve_stage;
revoke execute on function public._approve_stage(uuid) from public, anon, authenticated;
revoke execute on function public.approve_stage(uuid) from public, anon;
grant execute on function public.approve_stage(uuid) to authenticated;

-- ---------- 3. no amounts for field staff ----------
drop policy if exists spurch_field_select on public.stage_purchases;

-- Field staff get purchases WITHOUT amounts (they need who/what/when for
-- the buyer ≠ inspector rule and the stage history).
create function public.stage_purchases_for_field(p_request_id uuid)
returns table (id uuid, stage_id uuid, supplier_name text, purchased_by uuid,
               created_at timestamptz, note text)
language sql stable security definer set search_path = public
as $$
  select p.id, p.stage_id, p.supplier_name, p.purchased_by, p.created_at, p.note
    from public.stage_purchases p
   where p.request_id = p_request_id
     and public.is_assigned_to_request(p_request_id)
$$;
revoke execute on function public.stage_purchases_for_field(uuid) from public, anon;
grant execute on function public.stage_purchases_for_field(uuid) to authenticated;

-- Stage receipts (with amounts) only for the field user who uploaded them.
drop policy if exists media_field_stage_select on public.media;
create policy media_field_stage_select on public.media
  for select using (
    stage_id is not null
    and public.is_assigned_to_request(request_id)
    and (kind <> 'receipt' or uploader_id = auth.uid()));

-- ---------- 4. no cross-project media; strict storage paths ----------
drop policy if exists media_field_insert on public.media;
create policy media_field_insert on public.media
  for insert with check (
    uploader_id = auth.uid() and stage_id is null and exists (
      select 1 from public.jobs j
      where j.id = media.job_id and j.assigned_to = auth.uid()));

create or replace function public.media_insert_guard()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_uuid text := '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
  v_job_req uuid;
begin
  if new.stage_id is not null and new.job_id is not null then
    select request_id into v_job_req from public.jobs where id = new.job_id;
    if v_job_req is distinct from (select request_id from public.build_stages where id = new.stage_id) then
      raise exception 'job and stage belong to different projects';
    end if;
  end if;

  if new.stage_id is not null then
    select request_id into new.request_id from public.build_stages where id = new.stage_id;
    if auth.uid() is not null and new.storage_path !~
       ('^stages/' || new.stage_id::text || '/' || v_uuid || '\.(jpg|png|webp|mp4|mov|webm)$') then
      raise exception 'invalid storage path';
    end if;
  elsif new.job_id is not null then
    select request_id into new.request_id from public.jobs where id = new.job_id;
    if auth.uid() is not null and new.storage_path !~
       ('^jobs/' || new.job_id::text || '/' || v_uuid || '\.(jpg|png|webp|mp4|mov|webm)$') then
      raise exception 'invalid storage path';
    end if;
  end if;
  return new;
end $$;

create or replace function public.documents_insert_guard()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null and new.storage_path !~
     ('^requests/' || new.request_id::text
      || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|pdf)$') then
    raise exception 'invalid storage path';
  end if;
  return new;
end $$;
