-- ============================================================
-- Security hardening (from the pre-release security review)
--
-- 1. 2FA enforced IN THE DATABASE: staff (admin/field) sessions that have
--    not completed TOTP (JWT aal != 'aal2') get no data access, even when
--    calling the Supabase API directly with a valid password login.
-- 2. Audit log & rate limiter: no longer callable by anon/authenticated.
-- 3. Profiles: users may edit only their name/WhatsApp/country/locale.
-- 4. Field staff: no access to client profiles; first name is copied onto
--    the job instead (brief: "client first name + stand details").
-- 5. Reports: author fixed to the inserting user and immutable; published
--    only via the guarded update path; the job's field worker can never be
--    the publisher.
-- 6. Field uploads / extra costs / reports are pinned to the job's request.
-- ============================================================

-- ---------- 1. AAL2 for staff ----------
create or replace function public.is_aal2()
returns boolean language sql stable
as $$ select coalesce(auth.jwt()->>'aal', '') = 'aal2' $$;

-- Clients don't need 2FA; staff must have completed it this session.
create or replace function public.access_ok()
returns boolean language sql stable security definer set search_path = public
as $$
  select case
    when auth.uid() is null then true            -- anon: permissive policies decide (they grant nothing)
    when public.current_user_role() = 'client' then true
    else public.is_aal2()
  end
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select public.current_user_role() = 'admin' and public.is_aal2() $$;

create or replace function public.is_field()
returns boolean language sql stable security definer set search_path = public
as $$ select public.current_user_role() = 'field' and public.is_aal2() $$;

-- RESTRICTIVE policy on every table: AND-ed with the permissive ones.
do $$
declare t text;
begin
  foreach t in array array[
    'settings','audit_log','call_bookings','service_requests','documents',
    'quotes','quote_lines','payments','ledger_entries','invoices','jobs',
    'media','extra_cost_requests','approvals','reports','supplier_quotes',
    'messages','notify_interest','translation_reviews','rate_limits'
  ] loop
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated
         using (public.access_ok()) with check (public.access_ok())',
      t || '_require_aal2_for_staff', t);
  end loop;
end $$;

-- profiles: a staff member at aal1 may still read their OWN row (the app
-- needs the role to send them to the 2FA screen) but nothing else.
create policy profiles_require_aal2_for_staff_read on public.profiles
  as restrictive for select to authenticated
  using (public.access_ok() or id = auth.uid());
create policy profiles_require_aal2_for_staff_write on public.profiles
  as restrictive for update to authenticated
  using (public.access_ok()) with check (public.access_ok());
create policy profiles_require_aal2_for_staff_insert on public.profiles
  as restrictive for insert to authenticated
  with check (public.access_ok());
create policy profiles_require_aal2_for_staff_delete on public.profiles
  as restrictive for delete to authenticated
  using (public.access_ok());

-- Client-callable RPCs: also refuse staff sessions without 2FA.
create or replace function public.assert_access_ok()
returns void language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.access_ok() then
    raise exception 'two-factor authentication required';
  end if;
end $$;

-- ---------- 2. lock down internal SECURITY DEFINER functions ----------
revoke execute on function public.log_audit(text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.rate_limit_hit(text, int, int) from public, anon, authenticated;
grant execute on function public.log_audit(text, text, text, jsonb) to service_role;
grant execute on function public.rate_limit_hit(text, int, int) to service_role;

-- Admin-facing audit entry point: only a 2FA'd admin may write, and the
-- actor is always taken from the session (cannot be spoofed).
create or replace function public.admin_log_audit(
  p_action text, p_entity text, p_entity_id text, p_data jsonb default '{}'
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorised';
  end if;
  perform public.log_audit(p_action, p_entity, p_entity_id, p_data);
end $$;
revoke execute on function public.admin_log_audit(text, text, text, jsonb) from public, anon;
grant execute on function public.admin_log_audit(text, text, text, jsonb) to authenticated;

-- Service-role-only lookup used by the public booking form, so bookings are
-- matched against the verified auth email — never a user-editable column.
create or replace function public.find_user_id_by_email(p_email text)
returns uuid
language sql stable security definer set search_path = public, auth
as $$ select id from auth.users where lower(email) = lower(p_email) limit 1 $$;
revoke execute on function public.find_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.find_user_id_by_email(text) to service_role;

-- ---------- 3. profiles: column-level update rights ----------
revoke update on public.profiles from anon, authenticated;
grant update (full_name, whatsapp, country, locale) on public.profiles to authenticated;

-- ---------- 4. field staff: no client profile access ----------
drop policy if exists profiles_field_assigned_clients on public.profiles;

alter table public.jobs add column if not exists client_first_name text not null default '';

create or replace function public.jobs_set_client_first_name()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  select coalesce(split_part(p.full_name, ' ', 1), '')
    into new.client_first_name
    from public.service_requests r
    join public.profiles p on p.id = r.client_id
   where r.id = new.request_id;
  new.client_first_name := coalesce(new.client_first_name, '');
  return new;
end $$;

create trigger jobs_set_client_first_name
  before insert or update of request_id on public.jobs
  for each row execute function public.jobs_set_client_first_name();

-- ---------- 5. reports: author integrity & no self sign-off ----------
create or replace function public.reports_insert_guard()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null then
    -- authenticated inserts: you are the author, and it starts as a draft
    new.author_id := auth.uid();
    if new.status not in ('draft', 'submitted') then
      raise exception 'new reports must start as a draft';
    end if;
    new.published_by := null;
    new.published_at := null;
  end if;
  -- pin the report to its job's request
  if new.job_id is not null then
    select request_id into new.request_id from public.jobs where id = new.job_id;
  end if;
  return new;
end $$;

create trigger reports_insert_guard
  before insert on public.reports
  for each row execute function public.reports_insert_guard();

create or replace function public.reports_guard()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_worker uuid;
begin
  if auth.uid() is not null then
    -- authorship and routing are immutable for everyone
    if new.author_id is distinct from old.author_id
       or new.job_id is distinct from old.job_id
       or new.request_id is distinct from old.request_id then
      raise exception 'report author, job and request cannot be changed';
    end if;
  end if;

  if new.status = 'published' and (old.status is distinct from 'published') then
    if auth.uid() is not null then
      if not public.is_admin() then
        raise exception 'only admin may publish a report';
      end if;
      if new.author_id = auth.uid() then
        raise exception 'a report cannot be published by its own author';
      end if;
      select assigned_to into v_worker from public.jobs where id = new.job_id;
      if v_worker is not null and v_worker = auth.uid() then
        raise exception 'a report cannot be published by its own author';
      end if;
      new.published_by := auth.uid();
    end if;
    new.published_at := now();
    if new.verdict is null then
      raise exception 'a published report needs a verdict';
    end if;
  elsif auth.uid() is not null and old.status = 'published'
        and new.status is distinct from old.status then
    raise exception 'a published report cannot be unpublished';
  end if;

  if auth.uid() is not null and not public.is_admin() then
    if old.status not in ('draft','changes_requested')
       or new.status not in ('draft','submitted') then
      raise exception 'field staff may only edit drafts and submit them';
    end if;
  end if;

  new.updated_at := now();
  return new;
end $$;

-- ---------- 6. pin field rows to the job's request + storage prefix ----------
create or replace function public.media_insert_guard()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.job_id is not null then
    select request_id into new.request_id from public.jobs where id = new.job_id;
    if auth.uid() is not null
       and new.storage_path not like 'jobs/' || new.job_id::text || '/%' then
      raise exception 'invalid storage path';
    end if;
  end if;
  return new;
end $$;
create trigger media_insert_guard
  before insert on public.media
  for each row execute function public.media_insert_guard();

create or replace function public.ecr_insert_guard()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  select request_id into new.request_id from public.jobs where id = new.job_id;
  if auth.uid() is not null then
    new.requested_by := auth.uid();
    new.status := 'pending';
  end if;
  return new;
end $$;
create trigger ecr_insert_guard
  before insert on public.extra_cost_requests
  for each row execute function public.ecr_insert_guard();

create or replace function public.documents_insert_guard()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null
     and new.storage_path not like 'requests/' || new.request_id::text || '/%' then
    raise exception 'invalid storage path';
  end if;
  return new;
end $$;
create trigger documents_insert_guard
  before insert on public.documents
  for each row execute function public.documents_insert_guard();

-- ---------- client RPCs: refuse staff sessions without 2FA ----------
-- (accept_quote / decide_approval / approve_supplier_quote already require
--  the caller to own the request, so only clients can use them; nothing else
--  to add.)
